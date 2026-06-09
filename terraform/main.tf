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

# Virtual Network
resource "azurerm_virtual_network" "main" {
  name                = "${var.app_name}-vnet"
  address_space       = [var.vnet_cidr]
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
}

# Subnet for App Service
resource "azurerm_subnet" "app" {
  name                 = "${var.app_name}-app-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.app_subnet_cidr]

  delegation {
    name = "delegation"
    service_delegation {
      name = "Microsoft.Web/serverFarms"
    }
  }

  service_endpoints = ["Microsoft.Storage"]
}

# Subnet for Storage Private Endpoint
resource "azurerm_subnet" "storage" {
  name                 = "${var.app_name}-storage-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.storage_subnet_cidr]

  private_endpoint_network_policies_enabled = true
}

# Storage Account (Private)
resource "azurerm_storage_account" "main" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  # Make it private - no public access
  public_network_access_enabled = false

  # Allow access only via service endpoints and private endpoints
  network_rules {
    default_action             = "Deny"
    virtual_network_subnet_ids = [azurerm_subnet.app.id]
    bypass                     = ["AzureServices"]
  }
}

# Uploads Container
resource "azurerm_storage_container" "uploads" {
  name                  = "uploads"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

# Private Endpoint for Storage Account Blob Service
resource "azurerm_private_endpoint" "storage" {
  name                = "${var.app_name}-storage-pe"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = azurerm_subnet.storage.id

  private_service_connection {
    name                           = "storage-connection"
    private_connection_resource_id = azurerm_storage_account.main.id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }
}

# Private DNS Zone for Storage Account
resource "azurerm_private_dns_zone" "storage" {
  name                = "privatelink.blob.core.windows.net"
  resource_group_name = azurerm_resource_group.main.name
}

# Link Private DNS Zone to VNet
resource "azurerm_private_dns_zone_virtual_network_link" "storage" {
  name                  = "${var.app_name}-storage-dns-link"
  resource_group_name   = azurerm_resource_group.main.name
  private_dns_zone_name = azurerm_private_dns_zone.storage.name
  virtual_network_id    = azurerm_virtual_network.main.id
}

# DNS A Record for Storage Account
resource "azurerm_private_dns_a_record" "storage" {
  name                = azurerm_storage_account.main.name
  zone_name           = azurerm_private_dns_zone.storage.name
  resource_group_name = azurerm_resource_group.main.name
  ttl                 = 300
  records             = [azurerm_private_endpoint.storage.private_service_connection.0.private_ip_address]
}

# App Service Plan (Linux)
resource "azurerm_service_plan" "main" {
  name                = "${var.app_name}-asp"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = var.app_service_sku

  depends_on = [azurerm_subnet.app]
}

# App Service
resource "azurerm_linux_web_app" "main" {
  name                = var.app_service_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.main.id

  # Virtual Network Integration
  virtual_network_subnet_id = azurerm_subnet.app.id

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
    "AZURE_STORAGE_ACCOUNT_NAME"      = azurerm_storage_account.main.name
    "AZURE_STORAGE_BLOB_CONTAINER_NAME" = "uploads"
    "PORT"                             = "8000"
    "FRONTEND_ORIGIN"                  = var.frontend_origin
    "MAX_FILE_SIZE_MB"                 = "2048"
    "SAS_EXPIRY_MINUTES"               = "20"
    "SAS_RATE_LIMIT_PER_MINUTE"        = "30"
    "WEBSITES_PORT"                    = "8000"
  }

  https_only = true
}

# Managed Identity - Get current tenant ID
data "azurerm_client_config" "current" {}

# Role Assignment: Storage Blob Data Contributor for App Service Managed Identity
resource "azurerm_role_assignment" "storage_blob_contributor" {
  scope              = azurerm_storage_account.main.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id       = azurerm_linux_web_app.main.identity[0].principal_id
}

# Allow App Service to read from storage via private endpoint
resource "azurerm_storage_account_network_rule" "app_service" {
  storage_account_id = azurerm_storage_account.main.id

  default_action             = "Deny"
  virtual_network_subnet_ids = [azurerm_subnet.app.id]
  bypass                     = ["AzureServices"]
}
