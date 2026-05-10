/**
 * middleware/requestLogger.js
 * Structured HTTP access log — logs method, path, status, duration, IP.
 * Skips /health to avoid log noise from container probes.
 */

const logger = require("../utils/logger");

function requestLogger(req, res, next) {
  // Skip noisy health-check probes
  if (req.path === "/health") return next();

  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? "error"
                : res.statusCode >= 400 ? "warn"
                : "http";

    logger[level]("HTTP request", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip || req.socket?.remoteAddress,
      user_agent: req.get("user-agent"),
      content_length: res.get("content-length") || 0,
    });
  });

  next();
}

module.exports = { requestLogger };
