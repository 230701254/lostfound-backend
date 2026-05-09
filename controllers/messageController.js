const { getMessageContainer } = require("../config/azure");

/**
 * GET /messages/:itemId — Get all messages for an item
 */
async function getMessages(req, res) {
  const { itemId } = req.params;

  if (!itemId) {
    return res.status(400).json({ success: false, message: "itemId is required" });
  }

  try {
    const container = getMessageContainer();

    const { resources } = await container.items.query({
      query: "SELECT * FROM c WHERE c.itemId = @itemId ORDER BY c.timestamp ASC",
      parameters: [{ name: "@itemId", value: itemId }]
    }).fetchAll();

    return res.json({ success: true, messages: resources });

  } catch (err) {
    console.error("❌ getMessages:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch messages." });
  }
}

module.exports = { getMessages };
