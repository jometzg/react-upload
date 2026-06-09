# Terraform Infrastructure for React Upload Backend

Complete Infrastructure-as-Code to deploy the Python backend to Azure App Service with a private storage account.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Virtual Network (10.0.0.0/16)            │
│                                                             │
│  ┌──────────────────────┐    ┌──────────────────────┐     │
│  │  App Subnet          │    │ Storage Subnet       │     │
│  │  (10.0.1.0/24)       │    │ (10.0.2.0/24)        │     │
│  │                      │    │                      │     │
│  │  ┌────────────────┐  │    │  ┌────────────────┐ │     │
│  │  │ App Service    │  │    │  │ Private        │ │     │
│  │  │ (Linux)        │  │    │  │ Endpoint       │ │     │
│  │  │ + Managed ID   │  │    │  │ (Storage)      │ │     │
│  │  └────────────────┘  │    │  └────────────────┘ │     │
│  │                      │    │         │            │     │
│  └──────────────────────┘    └─────────┼────────────┘     │
│                                        │                  │
└────────────────────────────────────────┼──────────────────┘
                                         │
                    ┌────────────────────┘
                    │
            ┌───────▼───────┐
            │ Private DNS   │
            │ Zone          │
            └───────────────┘
                    │
            ┌───────▼───────────┐
            │ Storage Account   │
            │ (Private)         │
            │ ├─ Blob Service   │
            │ └─ uploads/       │
            └───────────────────┘
```

## Components

### Network
- **Virtual Network (VNet)**: 10.0.0.0/16 — isolated network for app and storage
- **App Subnet**: 10.0.1.0/24 — hosts the App Service
- **Storage Subnet**: 10.0.2.0/24 — hosts the private endpoint for storage

### Storage
- **Storage Account**: Private (no public access allowed)
- **Network Rules**: Only accepts traffic from the App Subnet via Service Endpoints
- **Private Endpoint**: Allows secure connectivity from within the VNet
- **Uploads Container**: Private container for file uploads
- **Private DNS Zone**: Resolves `<storage>.blob.core.windows.net` to the private endpoint IP

### App Service
- **Linux App Service Plan**: Hosts the Python FastAPI backend
- **Managed Identity**: System-assigned identity for secure Azure authentication
- **Role Assignment**: Storage Blob Data Contributor — allows app to read/write blobs and issue SAS tokens
- **VNet Integration**: App runs within the virtual network for private connectivity to storage

## Prerequisites

1. **Azure Subscription**: Access to an active Azure subscription
2. **Terraform**: v1.0 or later ([install](https://www.terraform.io/downloads.html))
3. **Azure CLI**: Logged in with `az login` and appropriate permissions
4. **Git** (optional): For version control of Terraform state

## Deployment Steps

### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

This downloads the Terraform Azure provider and initializes the working directory.

### 2. Create Variables File

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and set:
- `app_service_name`: **Must be globally unique** (e.g., `my-app-react-upload-prod`)
- `storage_account_name`: **Must be globally unique**, 3-24 lowercase alphanumeric (e.g., `mystgacct2026`)
- `frontend_origin`: URL where your React frontend is deployed (e.g., `https://myapp.azurewebsites.net`)
- Other settings as needed (region, SKU, etc.)

### 3. Validate Configuration

```bash
terraform plan
```

Review the planned resources before deploying.

### 4. Deploy Infrastructure

```bash
terraform apply
```

Type `yes` to confirm. This will:
- Create the resource group
- Create the virtual network with subnets
- Create the private storage account and uploads container
- Create the private endpoint and DNS zone
- Create the App Service Plan and App Service
- Assign the managed identity and role
- Configure networking rules

Deployment typically takes 3-5 minutes.

### 5. Capture Outputs

After deployment completes, save the output values:

```bash
terraform output
```

Key outputs:
- `app_service_default_hostname`: URL to access the backend API
- `storage_account_name`: Storage account name for reference
- `app_service_principal_id`: Managed identity principal ID

## Configuration

The Terraform variables control:

| Variable | Purpose | Default |
|---|---|---|
| `location` | Azure region | East US |
| `resource_group_name` | Resource group name | react-upload-rg |
| `app_service_sku` | App Service Plan tier | B1 (free) |
| `frontend_origin` | CORS allowed origin | http://localhost:5173 |
| `vnet_cidr` / `app_subnet_cidr` / `storage_subnet_cidr` | Network ranges | 10.0.0.0/16, etc. |

See `variables.tf` for all options.

## Deploying the Python Backend

After infrastructure is created:

### 1. Prepare Backend Code

```bash
cd ../backend-python
zip -r backend.zip . -x "venv/*" "__pycache__/*" ".git/*"
```

### 2. Deploy via Azure Portal or CLI

**Option A: Azure Portal**
1. Go to the App Service resource
2. Deployment Center → Source: Local Git / GitHub / Zip Upload
3. Upload `backend.zip`

**Option B: Azure CLI**
```bash
az webapp deployment source config-zip \
  --resource-group react-upload-rg \
  --name <app-service-name> \
  --src backend.zip
```

**Option C: Visual Studio Code Azure App Service Extension**
- Install extension: ms-azuretools.vscode-azureappservice
- Right-click App Service → Deploy to Web App → Choose folder

### 3. Configure App Settings (if not already set by Terraform)

In the App Service → Settings → Configuration:
- `AZURE_STORAGE_ACCOUNT_NAME`: Set to your storage account name
- `FRONTEND_ORIGIN`: Set to your frontend URL

The managed identity will automatically authenticate with the storage account.

## Network Security

### Storage Account
- ✅ No public network access (`publicNetworkAccess: false`)
- ✅ Default deny for network rules
- ✅ Whitelist only the App Subnet via Service Endpoints
- ✅ Private Endpoint for direct VNet connectivity
- ✅ Private DNS Zone for name resolution

### App Service
- ✅ VNet integration — traffic to storage stays within the network
- ✅ System-assigned Managed Identity — no secrets in code
- ✅ HTTPS-only (`https_only: true`)
- ✅ TLS 1.2 minimum

## Monitoring & Troubleshooting

### Check Connectivity

```bash
# SSH into App Service (if available)
az webapp ssh --resource-group react-upload-rg --name <app-service-name>

# From within the container, test storage access
python -c "from azure.storage.blob import BlobServiceClient; \
client = BlobServiceClient(account_url='https://<storage>.blob.core.windows.net/', \
credential=DefaultAzureCredential()); \
print(list(client.list_containers()))"
```

### View Logs

```bash
az webapp log tail --resource-group react-upload-rg --name <app-service-name>
```

### Common Issues

**"This request is not authorized"**
- Ensure the App Service managed identity has the Storage Blob Data Contributor role
- Check that the storage account network rules allow the app subnet

**"Connection refused to private endpoint"**
- Verify the private endpoint DNS zone is linked to the VNet
- Check the private DNS A record points to the correct IP

**"Container/Blob not found"**
- Ensure the `uploads` container was created (check in Terraform output)
- Verify the managed identity role assignment scope includes the container

## Cleanup

To destroy all resources and avoid unexpected charges:

```bash
terraform destroy
```

Type `yes` to confirm. This will delete:
- All resources created by Terraform
- Resource group (if empty)
- Storage account and data (⚠️ **Warning: data loss**)

## Production Considerations

For production deployment:

1. **Terraform State**: Store state in Azure Blob Storage backend, not local
   ```hcl
   terraform {
     backend "azurerm" {
       resource_group_name  = "terraform-state-rg"
       storage_account_name = "tfstatestg"
       container_name       = "tfstate"
       key                  = "prod.tfstate"
     }
   }
   ```

2. **App Service Tier**: Use at least `P1V2` for production workloads

3. **Scaling**: Add `zone_redundancy_enabled = true` and configure auto-scale

4. **Monitoring**: Enable Azure Monitor and Application Insights:
   ```hcl
   resource "azurerm_application_insights" "main" { ... }
   ```

5. **Backup**: Configure storage account backups and replication (e.g., `GRS` instead of `LRS`)

6. **DNS**: Use a custom domain with Azure DNS or another DNS provider

7. **CI/CD**: Integrate with GitHub Actions or Azure Pipelines for automated deployments

## References

- [Terraform Azure Provider Docs](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Azure App Service Documentation](https://learn.microsoft.com/en-us/azure/app-service/)
- [Azure Storage Private Endpoints](https://learn.microsoft.com/en-us/azure/storage/common/storage-private-endpoints)
- [Azure Managed Identities](https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview)
