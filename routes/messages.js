const express = require("express");
const router = express.Router();
const { getMessages } = require("../controllers/messageController");

// GET /messages/:itemId
router.get("/:itemId", getMessages);

module.exports = router;
