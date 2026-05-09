require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { initAzure } = require("./config/azure");
const itemRoutes = require("./routes/items");
const messageRoutes = require("./routes/messages");
const matchRoutes = require("./routes/match");
const { initSocket } = require("./socket/chat");

// ── Azure Init ─────────────────────────────────────────────────────
initAzure();

// ── App Setup ──────────────────────────────────────────────────────
const app = express();
app.set("trust proxy", 1);

// ── Security Headers ───────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ── CORS ───────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : "*",
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  optionsSuccessStatus: 204
}));

// ── Body Parsing ────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ── Rate Limiting ──────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." }
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, message: "Upload limit reached. Please wait a moment." }
});

app.use(globalLimiter);

// ── Health Check (Docker HEALTHCHECK + Azure Container Apps probe) ──
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Lost & Found API",
    version: "2.0.0",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

// ── Routes ─────────────────────────────────────────────────────────
app.use("/items", itemRoutes);
app.use("/messages", messageRoutes);
app.use("/match", matchRoutes);

// Upload limiter for item POST
app.use("/items/:type", (req, res, next) => {
  if (req.method === "POST") return uploadLimiter(req, res, next);
  next();
});

// ── Root ───────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "Lost & Found API",
    version: "2.0.0",
    timestamp: new Date().toISOString()
  });
});

// ── 404 ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`
  });
});

// ── Global Error Handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File too large. Max 5MB."
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

// ── Socket.IO ──────────────────────────────────────────────────────
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 30000,
  pingInterval: 10000
});

initSocket(io);

// ── Start ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Lost & Found API v2.0.0 running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
});

// ── Graceful Shutdown ──────────────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n⚠️  ${signal} received — shutting down gracefully...`);

  server.close((err) => {
    if (err) {
      console.error("❌ Error during server close:", err);
      process.exit(1);
    }

    io.close(() => {
      console.log("🔌 Socket.IO closed");
      console.log("✅ Graceful shutdown complete");
      process.exit(0);
    });
  });

  // Force-kill if drain exceeds 10 s (prevents hung containers)
  setTimeout(() => {
    console.error("❌ Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // Docker stop / ACA
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));  // Ctrl-C

process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️  Unhandled rejection at:", promise, "reason:", reason);
});
