const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { validateItemUpload, validateDelete } = require("../middleware/validate");
const { createItem, getItems, getItemById, deleteItem } = require("../controllers/itemController");

// Validate type param middleware
function checkType(req, res, next) {
  const { type } = req.params;
  if (!["lost", "found"].includes(type)) {
    return res.status(400).json({ success: false, message: "Type must be 'lost' or 'found'" });
  }
  next();
}

// GET /items/:type?search=&location=
router.get("/:type", checkType, getItems);

// GET /items/:type/:id
router.get("/:type/:id", checkType, getItemById);

// POST /items/:type
router.post("/:type", checkType, upload.single("image"), validateItemUpload, createItem);

// DELETE /items/:type/:id
router.delete("/:type/:id", checkType, validateDelete, deleteItem);

module.exports = router;
