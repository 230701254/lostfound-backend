const { BlobServiceClient } = require("@azure/storage-blob");
const { CosmosClient } = require("@azure/cosmos");

let blobServiceClient;
let database;
let lostContainer;
let foundContainer;
let messageContainer;

function initAzure() {
  console.log("blob:", process.env.blobConnectionString);
  console.log("cosmos:", process.env.cosmosConnectionString);
  const blobConnectionString = process.env.blobConnectionString;
  const cosmosConnectionString = process.env.cosmosConnectionString;

  if (!blobConnectionString || !cosmosConnectionString) {
    console.error("❌ Missing required environment variables: BLOB_CONNECTION_STRING, COSMOS_CONNECTION_STRING");
    process.exit(1);
  }

  blobServiceClient = BlobServiceClient.fromConnectionString(blobConnectionString);

  const cosmosClient = new CosmosClient(cosmosConnectionString);
  database = cosmosClient.database("lostfound-db");

  lostContainer = database.container("lost_items");
  foundContainer = database.container("found_items");
  messageContainer = database.container("messages");

  console.log("✅ Azure clients initialized");
}

function getBlobServiceClient() {
  return blobServiceClient;
}

function getContainer(type) {
  if (type === "found") return foundContainer;
  if (type === "lost") return lostContainer;
  return null;
}

function getMessageContainer() {
  return messageContainer;
}

module.exports = { initAzure, getBlobServiceClient, getContainer, getMessageContainer };
