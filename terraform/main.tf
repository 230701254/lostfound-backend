# ================================
# Resource Group
# ================================

resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
}

# ================================
# Storage Account
# ================================

resource "azurerm_storage_account" "storage" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location

  account_tier             = "Standard"
  account_replication_type = "LRS"

  min_tls_version          = "TLS1_2"

  allow_nested_items_to_be_public = false
}

# ================================
# Blob Container
# ================================

resource "azurerm_storage_container" "uploads" {
  name                  = var.blob_container_name
  storage_account_id    = azurerm_storage_account.storage.id
  container_access_type = "private"
}

# ================================
# Cosmos DB Account
# ================================

resource "azurerm_cosmosdb_account" "cosmos" {
  name                = var.cosmos_account_name
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  offer_type = "Standard"
  kind       = "GlobalDocumentDB"

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = azurerm_resource_group.rg.location
    failover_priority = 0
  }

  capabilities {
    name = "EnableServerless"
  }

  free_tier_enabled = true
}

# ================================
# Cosmos Database
# ================================

resource "azurerm_cosmosdb_sql_database" "database" {
  name                = var.cosmos_database_name
  resource_group_name = azurerm_resource_group.rg.name
  account_name        = azurerm_cosmosdb_account.cosmos.name
}

# ================================
# Cosmos Container
# ================================

resource "azurerm_cosmosdb_sql_container" "container" {
  name                  = var.cosmos_container_name
  resource_group_name   = azurerm_resource_group.rg.name
  account_name          = azurerm_cosmosdb_account.cosmos.name
  database_name         = azurerm_cosmosdb_sql_database.database.name

  partition_key_paths   = ["/id"]
  partition_key_version = 1
}

# ================================
# Log Analytics Workspace
# ================================

resource "azurerm_log_analytics_workspace" "logs" {
  name                = var.log_analytics_name
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  sku               = "PerGB2018"
  retention_in_days = 30
}

# ================================
# Application Insights
# ================================

resource "azurerm_application_insights" "appinsights" {
  name                = var.application_insights_name
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  workspace_id        = azurerm_log_analytics_workspace.logs.id
  application_type    = "web"
}