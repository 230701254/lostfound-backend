/**
 * socket/chat.js
 * Socket.IO chat handler with structured logging and input validation.
 */

const { v4: uuidv4 } = require("uuid");
const { getMessageContainer } = require("../config/azure");
const logger = require("../utils/logger");

// Limits
const MAX_MESSAGE_LEN = 1000;
const MAX_USER_LEN    = 150;
const MAX_ITEM_ID_LEN = 100;

function initSocket(io) {
  io.on("connection", (socket) => {
    const clientIp = socket.handshake.address;
    logger.info("Socket connected", { socketId: socket.id, ip: clientIp });

    socket.on("joinRoom", ({ itemId }) => {
      if (!itemId || typeof itemId !== "string") return;
      const safeItemId = itemId.trim().slice(0, MAX_ITEM_ID_LEN);
      if (!safeItemId) return;

      socket.join(safeItemId);
      logger.debug("Socket joined room", { socketId: socket.id, itemId: safeItemId });
    });

    socket.on("sendMessage", async ({ itemId, message, user }) => {
      // Input validation
      if (!itemId || !message || !user) return;

      const safeItemId  = String(itemId).trim().slice(0, MAX_ITEM_ID_LEN);
      const safeMessage = String(message).trim().slice(0, MAX_MESSAGE_LEN);
      const safeUser    = String(user).trim().toLowerCase().slice(0, MAX_USER_LEN);

      if (!safeItemId || !safeMessage || !safeUser) return;

      const msgData = {
        id:        uuidv4(),
        itemId:    safeItemId,
        sender:    safeUser,
        message:   safeMessage,
        timestamp: new Date().toISOString(),
      };

      // Emit to room in real-time
      io.to(safeItemId).emit("receiveMessage", msgData);

      // Persist to Cosmos DB
      try {
        const container = getMessageContainer();
        await container.items.create(msgData);
        logger.debug("Message persisted", { itemId: safeItemId, sender: safeUser });
      } catch (err) {
        logger.error("Failed to persist message", {
          itemId: safeItemId,
          error: err.message,
        });
      }
    });

    socket.on("disconnect", (reason) => {
      logger.info("Socket disconnected", { socketId: socket.id, reason });
    });

    socket.on("error", (err) => {
      logger.error("Socket error", { socketId: socket.id, error: err.message });
    });
  });
}

module.exports = { initSocket };
