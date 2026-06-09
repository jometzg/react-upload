terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
}

# Storage Account (Public with CORS for browser uploads, secured by SAS tokens)
resource "azurerm_storage_account" "main" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  # Enable public access for browser-based SAS uploads
  public_network_access_enabled = true
}

# Uploads Container
resource "azurerm_storage_container" "uploads" {
  name                  = "uploads"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

# CORS Configuration for Blob Service (allows browser-based SAS uploads)
resource "azurerm_storage_account_cors" "blob" {
  storage_account_id = azurerm_storage_account.main.id

  cors_rule {
    # Frontend origins allowed to make requests to storage
    allowed_headers    = ["*"]
    allowed_methods    = ["GET", "HEAD", "PUT", "DELETE", "POST", "OPTIONS", "PATCH", "MERGE"]
    allowed_origins    = [var.frontend_origin, "http://localhost:5173", "http://127.0.0.1:5173"]
    exposed_headers    = ["Content-Length", "ETag", "x-ms-version"]
    max_age_in_seconds = 3600
  }
}

# App Service Plan (Linux)
resource "azurerm_service_plan" "main" {
  name                = "${var.app_name}-asp"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = var.app_service_sku
}

# App Service
resource "azurerm_linux_web_app" "main" {
  name                = var.app_service_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.main.id

  # Managed Identity
  identity {
    type = "SystemAssigned"
  }

  site_config {
    minimum_tls_version = "1.2"
    
    app_command_line = "python -m uvicorn main:app --host 0.0.0.0 --port 8000"

    application_stack {
      python_version = "3.12"
    }
  }

  app_settings = {
    "AZURE_STORAGE_ACCOUNT_NAME"       = azurerm_storage_account.main.name
    "AZURE_STORAGE_BLOB_CONTAINER_NAME" = "uploads"
    "PORT"                              = "8000"
    "FRONTEND_ORIGIN"                   = var.frontend_origin
    "MAX_FILE_SIZE_MB"                  = "2048"
    "SAS_EXPIRY_MINUTES"                = "20"
    "SAS_RATE_LIMIT_PER_MINUTE"         = "30"
    "WEBSITES_PORT"                     = "8000"
  }

  https_only = true
}

# Role Assignment: Storage Blob Data Contributor for App Service Managed Identity
resource "azurerm_role_assignment" "storage_blob_contributor" {
  scope              = azurerm_storage_account.main.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id       = azurerm_linux_web_app.main.identity[0].principal_id
}
