/**
 * server.js — Lost & Found API v2.1.0
 *
 * Security hardening:
 *  - Strong Helmet CSP / HSTS / referrer-policy configuration
 *  - CORS locked to ALLOWED_ORIGINS (required in prod)
 *  - Body-size limits (JSON + URL-encoded)
 *  - Tiered rate limiting (global / upload / match)
 *  - Secure error handler — no stack traces in prod
 *  - Environment validation at startup
 *
 * Observability:
 *  - Structured JSON logging via utils/logger.js (winston)
 *  - Request logging middleware (method, path, status, duration, IP)
 *  - Unhandled rejection / uncaught exception logging
 *  - Graceful-shutdown logging
 *  - Enriched /health endpoint
 */

require("dotenv").config();
require("./config/monitoring");
// ── Env validation (exits process on missing required vars) ─────────────────
const { validateEnv } = require("./utils/validateEnv");
validateEnv();

const express  = require("express");
const http     = require("http");
const { Server } = require("socket.io");
const cors     = require("cors");
const helmet   = require("helmet");
const rateLimit = require("express-rate-limit");

const logger   = require("./utils/logger");
const { requestLogger } = require("./middleware/requestLogger");
const { initAzure }     = require("./config/azure");
const itemRoutes        = require("./routes/items");
const messageRoutes     = require("./routes/messages");
const matchRoutes       = require("./routes/match");
const { initSocket }    = require("./socket/chat");

// ── Azure Init ───────────────────────────────────────────────────────────────
initAzure();

// ── App Setup ────────────────────────────────────────────────────────────────
const app = express();
app.set("trust proxy", 1);

// ── Security Headers (Helmet) ────────────────────────────────────────────────
app.use(
  helmet({
    // Content-Security-Policy — tight for an API (no browser UI)
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc:  ["'none'"],
        objectSrc:  ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    // Force HTTPS for 1 year; include sub-domains
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    // Prevent MIME sniffing
    noSniff: true,
    // Hide X-Powered-By
    hidePoweredBy: true,
    // Prevent clickjacking
    frameguard: { action: "deny" },
    // XSS filter (legacy browsers)
    xssFilter: true,
    // Referrer policy
    referrerPolicy: { policy: "no-referrer" },
    // Allow Azure Blob images cross-origin
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Disable Permissions-Policy exposure
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
  })
);

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: allowedOrigins.length ? allowedOrigins : false, // false = deny all in prod if unset
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  optionsSuccessStatus: 204,
  credentials: false,
};

// In development with no origins configured, open CORS for convenience
if (process.env.NODE_ENV !== "production" && allowedOrigins.length === 0) {
  corsOptions.origin = "*";
  logger.warn("CORS is open (*) — development mode only");
}

app.use(cors(corsOptions));

// ── Body Parsing (with strict size limits) ───────────────────────────────────
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: false, limit: "512kb" }));

// ── Request Logger ───────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
  handler: (req, res, next, options) => {
    logger.warn("Rate limit exceeded", { ip: req.ip, path: req.path });
    res.status(options.statusCode).json(options.message);
  },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 5,
  message: { success: false, message: "Upload limit reached. Please wait a moment." },
  handler: (req, res, next, options) => {
    logger.warn("Upload rate limit exceeded", { ip: req.ip });
    res.status(options.statusCode).json(options.message);
  },
});

const matchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,
  message: { success: false, message: "Match request limit reached. Please wait." },
});

app.use(globalLimiter);

// ── Health Check ─────────────────────────────────────────────────────────────
const START_TIME = Date.now();

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Lost & Found API",
    version: "2.1.0",
    uptime_seconds: Math.floor(process.uptime()),
    uptime_human: formatUptime(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    node_version: process.version,
  });
});

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/items",    itemRoutes);
app.use("/messages", messageRoutes);
app.use("/match",    matchLimiter, matchRoutes);

// Upload-specific rate limiter (POST /items/:type)
app.use("/items/:type", (req, res, next) => {
  if (req.method === "POST") return uploadLimiter(req, res, next);
  next();
});

// ── Root ──────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "Lost & Found API",
    version: "2.1.0",
    timestamp: new Date().toISOString(),
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Multer file-size error
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, message: "File too large. Max 5 MB." });
  }
  // Multer field-count error
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ success: false, message: "Unexpected file field." });
  }
  // Multer / upload filter errors (set status: 400 in fileFilter)
  if (err.status === 400) {
    return res.status(400).json({ success: false, message: err.message });
  }
  // SyntaxError from JSON body parser
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ success: false, message: "Invalid JSON body." });
  }

  // Log all unhandled errors with full context
  logger.error("Unhandled application error", {
    error: err.message,
    // Only include stack in development
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  // Never leak stack traces or internal details in production
  res.status(500).json({ success: false, message: "Internal server error" });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length
      ? allowedOrigins
      : process.env.NODE_ENV !== "production"
        ? "*"
        : false,
    methods: ["GET", "POST"],
  },
  pingTimeout: 30000,
  pingInterval: 10000,
  // Limit incoming event data size
  maxHttpBufferSize: 1e5, // 100 KB
});

initSocket(io);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3000;

server.listen(PORT, () => {
  logger.info("Server started", {
    version: "2.1.0",
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    pid: process.pid,
  });
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  logger.info(`${signal} received — starting graceful shutdown`);

  server.close((err) => {
    if (err) {
      logger.error("Error during HTTP server close", { error: err.message });
      process.exit(1);
    }

    io.close(() => {
      logger.info("Socket.IO closed");
      logger.info("Graceful shutdown complete");
      process.exit(0);
    });
  });

  // Force-kill if drain takes too long (prevents hung containers)
  setTimeout(() => {
    logger.error("Forced shutdown after timeout — drain took too long");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

// ── Process-level error logging ───────────────────────────────────────────────
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled promise rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack:  reason instanceof Error ? reason.stack  : undefined,
  });
  // Do NOT exit here — let the request fail normally
  // Set a health-degraded flag if you want readiness probe to fail
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception — process will exit", {
    error: err.message,
    stack: err.stack,
  });
  // Uncaught exceptions leave the process in an undefined state — always exit
  process.exit(1);
});
