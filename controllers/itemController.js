/**
 * controllers/itemController.js
 * Business logic for lost/found item CRUD.
 * All console.log/error replaced with structured logger.
 * Error messages never leak internal details to the client.
 */

const { v4: uuidv4 } = require("uuid");
const { getBlobServiceClient, getContainer } = require("../config/azure");
const logger = require("../utils/logger");
const { sanitizeFilename } = require("../middleware/upload");

const BLOB_CONTAINER = "images";

/**
 * Upload file buffer to Azure Blob Storage
 */
async function uploadToBlob(file, id) {
  const safeName = sanitizeFilename(file.originalname);
  const blobName = `${id}-${Date.now()}-${safeName}`;
  const containerClient = getBlobServiceClient().getContainerClient(BLOB_CONTAINER);

  await containerClient.createIfNotExists({ access: "blob" });

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: {
      blobContentType: file.mimetype,
    },
  });

  return blockBlobClient.url;
}

/**
 * POST /items/:type — Create item
 */
async function createItem(req, res) {
  const { type } = req.params;

  try {
    const { name, description, location, user } = req.body;

    if (!name || !location || !req.file) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const id = uuidv4();
    const imageUrl = await uploadToBlob(req.file, id);
    const category = name.toLowerCase().trim();

    const item = {
      id,
      name,
      description,
      location,
      imageUrl,
      type,
      user: user?.toLowerCase() || "unknown",
      category,
      createdAt: new Date().toISOString(),
    };

    const container = getContainer(type);
    await container.items.create(item);

    logger.info("Item created", { itemId: id, type, user: item.user });

    return res.status(201).json({ success: true, item });

  } catch (err) {
    logger.error("createItem failed", { type, error: err.message });
    return res.status(500).json({ success: false, message: "Failed to create item" });
  }
}

/**
 * GET /items/:type
 */
async function getItems(req, res) {
  const { type } = req.params;

  try {
    const container = getContainer(type);

    const { resources } = await container.items
      .query("SELECT * FROM c ORDER BY c.createdAt DESC")
      .fetchAll();

    return res.json({ success: true, items: resources });

  } catch (err) {
    logger.error("getItems failed", { type, error: err.message });
    return res.status(500).json({ success: false, message: "Failed to fetch items" });
  }
}

/**
 * GET /items/:type/:id
 */
async function getItemById(req, res) {
  const { type, id } = req.params;

  try {
    const container = getContainer(type);
    const { resource } = await container.item(id, id).read();

    if (!resource) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    return res.json({ success: true, item: resource });

  } catch (err) {
    logger.error("getItemById failed", { type, id, error: err.message });
    return res.status(500).json({ success: false, message: "Failed to fetch item" });
  }
}

/**
 * DELETE /items/:type/:id
 */
async function deleteItem(req, res) {
  const { type, id } = req.params;
  const { user } = req.body;

  try {
    const container = getContainer(type);
    const { resource } = await container.item(id, id).read();

    if (!resource) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    if (resource.user !== user.toLowerCase()) {
      logger.warn("Unauthorized delete attempt", { itemId: id, requestedBy: user });
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await container.item(id, id).delete();

    logger.info("Item deleted", { itemId: id, type, user });
    return res.json({ success: true });

  } catch (err) {
    logger.error("deleteItem failed", { type, id, error: err.message });
    return res.status(500).json({ success: false, message: "Failed to delete item" });
  }
}

module.exports = { createItem, getItems, getItemById, deleteItem };
