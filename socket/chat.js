const { v4: uuidv4 } = require("uuid");
const { getMessageContainer } = require("../config/azure");

function initSocket(io) {
  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join a room for a specific item
    socket.on("joinRoom", ({ itemId }) => {
      if (!itemId) return;
      socket.join(itemId);
      console.log(`👥 Socket ${socket.id} joined room: ${itemId}`);
    });

    // Handle incoming messages
    socket.on("sendMessage", async ({ itemId, message, user }) => {
      if (!itemId || !message || !user) return;

      // Sanitize
      const sanitizedMessage = String(message).trim().slice(0, 1000);
      const sanitizedUser = String(user).trim().toLowerCase();

      if (!sanitizedMessage) return;

      const msgData = {
        id: uuidv4(),
        itemId,
        sender: sanitizedUser,
        message: sanitizedMessage,
        timestamp: new Date().toISOString()
      };

      // Emit to room in real-time
      io.to(itemId).emit("receiveMessage", msgData);

      // Persist to database
      try {
        const container = getMessageContainer();
        await container.items.create(msgData);
      } catch (err) {
        console.error("❌ Failed to save message:", err.message);
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initSocket };
