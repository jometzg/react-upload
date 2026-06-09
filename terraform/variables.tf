variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "East US"
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "react-upload-rg"
}

variable "app_name" {
  description = "Application name (used as prefix for resources)"
  type        = string
  default     = "react-upload"
}

variable "app_service_name" {
  description = "Name of the App Service (must be globally unique)"
  type        = string
  validation {
    condition     = length(var.app_service_name) >= 3 && length(var.app_service_name) <= 24
    error_message = "App Service name must be between 3 and 24 characters."
  }
}

variable "storage_account_name" {
  description = "Name of the storage account (must be globally unique, 3-24 chars, lowercase alphanumeric)"
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.storage_account_name))
    error_message = "Storage account name must be 3-24 lowercase alphanumeric characters."
  }
}

variable "vnet_cidr" {
  description = "CIDR block for the virtual network"
  type        = string
  default     = "10.0.0.0/16"
}

variable "app_subnet_cidr" {
  description = "CIDR block for the App Service subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "storage_subnet_cidr" {
  description = "CIDR block for the Storage Private Endpoint subnet"
  type        = string
  default     = "10.0.2.0/24"
}

variable "app_service_sku" {
  description = "SKU for App Service Plan (e.g., B1, B2, P1V2)"
  type        = string
  default     = "B1"
}

variable "frontend_origin" {
  description = "CORS allowed origin for frontend"
  type        = string
  default     = "http://localhost:5173"
}
