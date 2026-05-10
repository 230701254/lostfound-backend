/**
 * config/azure.js
 * Azure Blob Storage + Cosmos DB initialization.
 * Connection strings are validated at startup (see utils/validateEnv.js).
 * Credentials are NEVER logged.
 */

const { BlobServiceClient } = require("@azure/storage-blob");
const { CosmosClient } = require("@azure/cosmos");
const logger = require("../utils/logger");

let blobServiceClient;
let database;
let lostContainer;
let foundContainer;
let messageContainer;

function initAzure() {
  const blobConnectionString   = process.env.blobConnectionString;
  const cosmosConnectionString = process.env.cosmosConnectionString;

  // validateEnv() already exits if these are missing, but double-check here
  if (!blobConnectionString || !cosmosConnectionString) {
    logger.error("Azure init failed: missing connection strings");
    process.exit(1);
  }

  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(blobConnectionString);

    const cosmosClient = new CosmosClient(cosmosConnectionString);
    database = cosmosClient.database("lostfound-db");

    lostContainer    = database.container("lost_items");
    foundContainer   = database.container("found_items");
    messageContainer = database.container("messages");

    logger.info("Azure clients initialized successfully");
  } catch (err) {
    logger.error("Azure initialization error", { error: err.message });
    process.exit(1);
  }
}

function getBlobServiceClient() {
  return blobServiceClient;
}

function getContainer(type) {
  if (type === "found") return foundContainer;
  if (type === "lost")  return lostContainer;
  return null;
}

function getMessageContainer() {
  return messageContainer;
}

module.exports = { initAzure, getBlobServiceClient, getContainer, getMessageContainer };
