output "resource_group_name" {
  description = "Name of the created resource group"
  value       = azurerm_resource_group.main.name
}

output "storage_account_id" {
  description = "ID of the storage account"
  value       = azurerm_storage_account.main.id
}

output "storage_account_name" {
  description = "Name of the storage account"
  value       = azurerm_storage_account.main.name
}

output "storage_account_url" {
  description = "Storage account blob endpoint URL"
  value       = azurerm_storage_account.main.primary_blob_endpoint
}

output "app_service_id" {
  description = "ID of the App Service"
  value       = azurerm_linux_web_app.main.id
}

output "app_service_name" {
  description = "Name of the App Service"
  value       = azurerm_linux_web_app.main.name
}

output "app_service_default_hostname" {
  description = "Default hostname of the App Service (API base URL)"
  value       = "https://${azurerm_linux_web_app.main.default_hostname}"
}

output "app_service_principal_id" {
  description = "Principal ID of the App Service managed identity"
  value       = azurerm_linux_web_app.main.identity[0].principal_id
}

output "deployment_info" {
  description = "Deployment summary"
  value = {
    resource_group         = azurerm_resource_group.main.name
    location               = azurerm_resource_group.main.location
    app_service            = azurerm_linux_web_app.main.default_hostname
    app_service_url        = "https://${azurerm_linux_web_app.main.default_hostname}"
    storage_account        = azurerm_storage_account.main.name
    storage_blob_endpoint  = azurerm_storage_account.main.primary_blob_endpoint
    managed_identity_id    = azurerm_linux_web_app.main.identity[0].principal_id
  }
}
