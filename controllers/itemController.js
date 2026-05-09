const { v4: uuidv4 } = require("uuid");
const { getBlobServiceClient, getContainer } = require("../config/azure");

const BLOB_CONTAINER = "images";

/**
 * Upload file buffer to Azure Blob Storage
 */
async function uploadToBlob(file, id) {
  const blobName = `${id}-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const containerClient = getBlobServiceClient().getContainerClient(BLOB_CONTAINER);

  await containerClient.createIfNotExists({ access: "blob" });

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: {
      blobContentType: file.mimetype
    }
  });

  return blockBlobClient.url;
}

/**
 * POST /items/:type — Create item (NO AI)
 */
async function createItem(req, res) {
  const { type } = req.params;

  try {
    const { name, description, location, user } = req.body;

    if (!name || !location || !req.file) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    const id = uuidv4();

    // ✅ Upload image
    const imageUrl = await uploadToBlob(req.file, id);

    // 🔥 CATEGORY FROM USER INPUT (NO GEMINI)
    const category = name.toLowerCase().trim();

    console.log("📦 Category:", category);

    // 🔥 FINAL ITEM OBJECT
    const item = {
      id,
      name,
      description,
      location,
      imageUrl,
      type,
      user: user?.toLowerCase() || "unknown",
      category, // ✅ important
      createdAt: new Date().toISOString()
    };

    const container = getContainer(type);
    await container.items.create(item);

    return res.status(201).json({
      success: true,
      item
    });

  } catch (err) {
    console.error(`❌ createItem [${type}]:`, err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to create item"
    });
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

    return res.json({
      success: true,
      items: resources
    });

  } catch (err) {
    console.error(`❌ getItems [${type}]:`, err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch items"
    });
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
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    return res.json({
      success: true,
      item: resource
    });

  } catch (err) {
    console.error(`❌ getItemById:`, err.message);
    return res.status(500).json({ success: false });
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
      return res.status(404).json({ success: false });
    }

    if (resource.user !== user.toLowerCase()) {
      return res.status(403).json({ success: false });
    }

    await container.item(id, id).delete();

    return res.json({ success: true });

  } catch (err) {
    console.error(`❌ deleteItem:`, err.message);
    return res.status(500).json({ success: false });
  }
}

module.exports = {
  createItem,
  getItems,
  getItemById,
  deleteItem
};