/**
 * utils/validateEnv.js
 * Validates required environment variables at startup.
 * Exits process if any required var is missing in production.
 */

const logger = require("./logger");

const REQUIRED = [
  "cosmosConnectionString",
  "blobConnectionString",
];

const RECOMMENDED = [
  "GEMINI_API_KEY",
  "ALLOWED_ORIGINS",
  "NODE_ENV",
];

function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.error("Missing required environment variables", { missing });
    process.exit(1);
  }

  const missingRecommended = RECOMMENDED.filter((key) => !process.env[key]);
  if (missingRecommended.length > 0) {
    logger.warn("Missing recommended environment variables", {
      missing: missingRecommended,
    });
  }

  // Warn if running production with wildcard CORS
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.ALLOWED_ORIGINS
  ) {
    logger.warn(
      "ALLOWED_ORIGINS is not set — CORS is open to all origins. " +
      "Set ALLOWED_ORIGINS in production."
    );
  }

  // Warn if Gemini key absent (non-fatal — app degrades gracefully)
  if (!process.env.GEMINI_API_KEY) {
    logger.warn("GEMINI_API_KEY not set — AI features will be unavailable");
  }

  logger.info("Environment validation passed", {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT || 3000,
  });
}

module.exports = { validateEnv };
