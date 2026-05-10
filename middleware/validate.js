/**
 * middleware/validate.js
 * Request validation with strict length caps and safe output.
 */

const logger = require("../utils/logger");

// Max lengths for text fields
const LIMITS = {
  name: 100,
  description: 1000,
  location: 200,
  user: 150,
  category: 100,
};

/**
 * Safely truncate + trim a string, return null if invalid.
 */
function safeString(val, maxLen) {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validation middleware for item creation
 */
function validateItemUpload(req, res, next) {
  const errors = [];

  const name        = safeString(req.body.name, LIMITS.name);
  const description = safeString(req.body.description, LIMITS.description);
  const location    = safeString(req.body.location, LIMITS.location);
  const user        = safeString(req.body.user, LIMITS.user);

  if (!name || name.length < 2)        errors.push("Name must be 2–100 characters");
  if (!description || description.length < 5) errors.push("Description must be 5–1000 characters");
  if (!location || location.length < 2) errors.push("Location must be 2–200 characters");
  if (!user)                            errors.push("User is required");

  if (!req.file) {
    errors.push("Image is required");
  } else {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      errors.push("Only JPEG, PNG, WEBP and GIF images are allowed");
    }
    if (req.file.size > 5 * 1024 * 1024) {
      errors.push("Image must be under 5 MB");
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // Write sanitized values back — downstream code reads from req.body
  req.body.name        = name;
  req.body.description = description;
  req.body.location    = location;
  req.body.user        = user.toLowerCase();

  next();
}

/**
 * Validate delete request
 */
function validateDelete(req, res, next) {
  const user = safeString(req.body.user, LIMITS.user);
  const { type } = req.params;

  if (!user) {
    return res.status(400).json({ success: false, message: "User is required" });
  }

  if (!["lost", "found"].includes(type)) {
    return res.status(400).json({ success: false, message: "Invalid item type" });
  }

  req.body.user = user.toLowerCase();
  next();
}

/**
 * Validate match request
 */
function validateMatch(req, res, next) {
  const category = safeString(req.body.category, LIMITS.category);
  const type     = safeString(req.body.type, 10);

  if (!category) {
    return res.status(400).json({ success: false, message: "category is required" });
  }
  if (!type || !["lost", "found"].includes(type)) {
    return res.status(400).json({ success: false, message: "type must be 'lost' or 'found'" });
  }

  req.body.category = category.toLowerCase();
  req.body.type     = type.toLowerCase();
  next();
}

module.exports = { validateItemUpload, validateDelete, validateMatch };
