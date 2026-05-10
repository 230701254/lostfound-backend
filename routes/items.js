const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { verifyFileMagicBytes } = require("../middleware/upload");
const { validateItemUpload, validateDelete } = require("../middleware/validate");
const { createItem, getItems, getItemById, deleteItem } = require("../controllers/itemController");

function checkType(req, res, next) {
  if (!["lost", "found"].includes(req.params.type)) {
    return res.status(400).json({ success: false, message: "Type must be 'lost' or 'found'" });
  }
  next();
}

router.get("/:type",     checkType, getItems);
router.get("/:type/:id", checkType, getItemById);

// Magic-byte check inserted between multer and validation
router.post("/:type",
  checkType,
  upload.single("image"),
  verifyFileMagicBytes,
  validateItemUpload,
  createItem
);

router.delete("/:type/:id", checkType, validateDelete, deleteItem);

module.exports = router;
