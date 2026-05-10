/**
 * middleware/upload.js
 * Hardened Multer config with:
 *  - Strict MIME allowlist
 *  - Magic-byte verification (checks buffer after upload)
 *  - Extension allowlist
 *  - Filename sanitization
 *  - 5 MB hard cap, 1 file max
 */

const multer = require("multer");
const path = require("path");
const logger = require("../utils/logger");

// ── Allowlists ───────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

// Magic bytes (file signatures) for each accepted type
const MAGIC_SIGNATURES = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png",  bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/gif",  bytes: [0x47, 0x49, 0x46, 0x38] },
  // WEBP: bytes 0-3 = RIFF, bytes 8-11 = WEBP
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0,
    extra: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] } },
];

// ── Filename sanitizer ───────────────────────────────────────────────────────

function sanitizeFilename(originalname) {
  return path.basename(originalname)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 100) || "upload";
}

// ── Magic-byte checker ───────────────────────────────────────────────────────

function matchesMagic(buffer, sig) {
  const primary = sig.bytes.every((b, i) => buffer[i + (sig.offset || 0)] === b);
  if (!primary) return false;
  if (sig.extra) {
    return sig.extra.bytes.every((b, i) => buffer[i + sig.extra.offset] === b);
  }
  return true;
}

function verifyMagicBytes(buffer, declaredMime) {
  const sig = MAGIC_SIGNATURES.find((s) => s.mime === declaredMime);
  if (!sig) return false;
  return matchesMagic(buffer, sig);
}

// ── Multer config ────────────────────────────────────────────────────────────

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // 1. MIME type check
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    logger.warn("Upload rejected: disallowed MIME type", {
      mimetype: file.mimetype,
      ip: req.ip,
    });
    return cb(
      Object.assign(
        new Error("Invalid file type. Only JPEG, PNG, WEBP and GIF are allowed."),
        { status: 400 }
      ),
      false
    );
  }

  // 2. Extension check
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    logger.warn("Upload rejected: disallowed extension", {
      extension: ext,
      ip: req.ip,
    });
    return cb(
      Object.assign(new Error("Invalid file extension."), { status: 400 }),
      false
    );
  }

  // 3. Sanitize filename in-place before storage
  file.originalname = sanitizeFilename(file.originalname);

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
    fields: 10,
    fieldNameSize: 100,
    fieldSize: 50 * 1024, // 50 KB per text field
  },
});

// ── Post-upload magic-byte middleware ────────────────────────────────────────
// Mount AFTER upload.single("image") to catch MIME-spoofed uploads

function verifyFileMagicBytes(req, res, next) {
  if (!req.file) return next();

  const ok = verifyMagicBytes(req.file.buffer, req.file.mimetype);
  if (!ok) {
    logger.warn("Upload rejected: magic-byte mismatch (possible MIME spoof)", {
      declaredMime: req.file.mimetype,
      ip: req.ip,
    });
    return res.status(400).json({
      success: false,
      message: "File content does not match declared type.",
    });
  }

  next();
}

module.exports = upload;
module.exports.verifyFileMagicBytes = verifyFileMagicBytes;
module.exports.sanitizeFilename = sanitizeFilename;
