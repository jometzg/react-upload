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

output "app_service_id" {
  description = "ID of the App Service"
  value       = azurerm_linux_web_app.main.id
}

output "app_service_name" {
  description = "Name of the App Service"
  value       = azurerm_linux_web_app.main.name
}

output "app_service_default_hostname" {
  description = "Default hostname of the App Service"
  value       = azurerm_linux_web_app.main.default_hostname
}

output "app_service_principal_id" {
  description = "Principal ID of the App Service managed identity"
  value       = azurerm_linux_web_app.main.identity[0].principal_id
}

output "vnet_id" {
  description = "ID of the virtual network"
  value       = azurerm_virtual_network.main.id
}

output "app_subnet_id" {
  description = "ID of the App Service subnet"
  value       = azurerm_subnet.app.id
}

output "storage_subnet_id" {
  description = "ID of the Storage Private Endpoint subnet"
  value       = azurerm_subnet.storage.id
}

output "private_endpoint_ip" {
  description = "Private IP address of the storage account private endpoint"
  value       = azurerm_private_endpoint.storage.private_service_connection[0].private_ip_address
}

output "deployment_info" {
  description = "Deployment summary"
  value = {
    resource_group = azurerm_resource_group.main.name
    location       = azurerm_resource_group.main.location
    app_service    = azurerm_linux_web_app.main.default_hostname
    storage_account = azurerm_storage_account.main.name
    vnet           = azurerm_virtual_network.main.name
  }
}
