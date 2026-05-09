/**
 * Validation middleware for item creation
 */
function validateItemUpload(req, res, next) {
  const { name, description, location, user } = req.body;

  const errors = [];

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push("Name must be at least 2 characters");
  }

  if (!description || typeof description !== "string" || description.trim().length < 5) {
    errors.push("Description must be at least 5 characters");
  }

  if (!location || typeof location !== "string" || location.trim().length < 2) {
    errors.push("Location must be at least 2 characters");
  }

  if (!user || typeof user !== "string") {
    errors.push("User is required");
  }

  if (!req.file) {
    errors.push("Image is required");
  } else {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      errors.push("Only JPEG, PNG, WEBP and GIF images are allowed");
    }

    const maxSizeMB = 5;
    if (req.file.size > maxSizeMB * 1024 * 1024) {
      errors.push(`Image must be under ${maxSizeMB}MB`);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // Sanitize strings
  req.body.name = name.trim();
  req.body.description = description.trim();
  req.body.location = location.trim();
  req.body.user = user.trim().toLowerCase();

  next();
}

/**
 * Validate delete request
 */
function validateDelete(req, res, next) {
  const { user } = req.body;
  const { type } = req.params;

  if (!user || typeof user !== "string") {
    return res.status(400).json({ success: false, message: "User is required" });
  }

  if (!["lost", "found"].includes(type)) {
    return res.status(400).json({ success: false, message: "Invalid item type" });
  }

  next();
}

module.exports = { validateItemUpload, validateDelete };
