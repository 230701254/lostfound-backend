/**
 * utils/logger.js
 * Structured JSON logger — production-grade, Render-compatible.
 *
 * Uses winston when available (production install), falls back to a thin
 * JSON-over-console shim so the app boots in dev without `npm install`.
 *
 * Log shape (JSON, one line):
 *  { level, message, timestamp, service, ...meta }
 */

const SERVICE = "lostfound-api";
const IS_PROD = process.env.NODE_ENV === "production";

// ── Try to load winston ──────────────────────────────────────────────────────
let logger;

try {
  const winston = require("winston");

  const formats = [
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
  ];

  // Pretty-print in dev, compact JSON in prod (Render ingests JSON logs)
  if (IS_PROD) {
    formats.push(winston.format.json());
  } else {
    formats.push(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp, ...rest }) => {
        const meta = Object.keys(rest).length ? " " + JSON.stringify(rest) : "";
        return `${timestamp} [${level}] ${message}${meta}`;
      })
    );
  }

  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || (IS_PROD ? "info" : "debug"),
    defaultMeta: { service: SERVICE },
    format: winston.format.combine(...formats),
    transports: [new winston.transports.Console()],
  });

} catch (_err) {
  // Winston not installed — use a minimal JSON shim
  const ts = () => new Date().toISOString();
  const emit = (level, message, meta = {}) => {
    const line = JSON.stringify({ level, message, timestamp: ts(), service: SERVICE, ...meta });
    if (level === "error" || level === "warn") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  };

  logger = {
    error: (msg, meta) => emit("error", msg, meta),
    warn:  (msg, meta) => emit("warn",  msg, meta),
    info:  (msg, meta) => emit("info",  msg, meta),
    http:  (msg, meta) => emit("http",  msg, meta),
    debug: (msg, meta) => emit("debug", msg, meta),
  };
}

module.exports = logger;
