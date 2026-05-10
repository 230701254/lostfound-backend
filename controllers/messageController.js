/**
 * controllers/messageController.js
 */

const { getMessageContainer } = require("../config/azure");
const logger = require("../utils/logger");

/**
 * GET /messages/:itemId — Get all messages for an item
 */
async function getMessages(req, res) {
  const { itemId } = req.params;

  if (!itemId || typeof itemId !== "string" || itemId.trim().length === 0) {
    return res.status(400).json({ success: false, message: "itemId is required" });
  }

  try {
    const container = getMessageContainer();

    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.itemId = @itemId ORDER BY c.timestamp ASC",
        parameters: [{ name: "@itemId", value: itemId.trim() }],
      })
      .fetchAll();

    return res.json({ success: true, messages: resources });

  } catch (err) {
    logger.error("getMessages failed", { itemId, error: err.message });
    return res.status(500).json({ success: false, message: "Failed to fetch messages" });
  }
}

module.exports = { getMessages };
