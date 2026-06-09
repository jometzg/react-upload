# Terraform Infrastructure for React Upload Backend

Complete Infrastructure-as-Code to deploy the Python backend to Azure App Service with public storage secured by SAS tokens.

## Architecture

```
┌─────────────────────────────────────────┐
│  App Service (Linux)                    │
│  ├─ Python FastAPI Backend              │
│  ├─ Managed Identity                    │
│  └─ Issues SAS tokens for uploads       │
└───────────────┬─────────────────────────┘
                │
                ▼
        ┌───────────────────┐
        │ Uploads                │
        │ (SAS token secured)     │
        └───────────────────┘
```

- Storage account: **Public endpoint** (browser can access)
- Security: **CORS** (restrict origins) + **SAS tokens** (time-limited, blob-scoped)
- Backend: **Managed Identity** (no secrets in code)
- Network: Simple, direct access (no VNet overhead)

## Components

### Storage
- **Storage Account**: Public endpoint (required for browser SAS uploads)
- **CORS Configuration**: Allows browser requests from your frontend origin only
- **SAS Token Security**: All uploads require short-lived, blob-scoped tokens issued by backend
- **Uploads Container**: Private container for file uploads

### App Service
- **Linux App Service Plan**: Hosts the Python FastAPI backend
- **Managed Identity**: System-assigned identity for secure Azure authentication
- **Role Assignment**: Storage Blob Data Contributor — allows app to issue SAS tokens
- **No VNet needed**: Direct, simple connectivity to storage

## Security Model

**Public Storage + SAS Tokens**:
- ✅ Storage account has public endpoint (required for browser)
- ✅ Browser can reach storage to upload via CORS
- ✅ CORS restricts requests to your frontend origin only
- ✅ SAS tokens required (issued by backend, valid ~20 min, blob-scoped)
- ✅ Without valid SAS, browser cannot upload
- ✅ **Result**: Secure, performant, simple architecture

## Prerequisites

1. **Azure Subscription**: Access to an active Azure subscription
2. **Terraform**: v1.0 or later ([install](https://www.terraform.io/downloads.html))
3. **Azure CLI**: Logged in with `az login`

## Deployment Steps

### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

### 2. Create Variables File

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and set:
- `app_service_name`: **Globally unique** (e.g., `my-upload-app-2026`)
- `storage_account_name`: **Globally unique**, 3-24 lowercase alphanumeric (e.g., `mystgacct2026`)
- `frontend_origin`: Your frontend URL (e.g., `https://myapp.azurewebsites.net`)

### 3. Validate Configuration

```bash
terraform plan
```

### 4. Deploy Infrastructure

```bash
terraform apply
```

Type `yes`. Deployment takes ~3-5 minutes.

### 5. Capture Outputs

```bash
terraform output
```

Key outputs:
- `app_service_default_hostname`: Backend API base URL
- `storage_account_name`: Your storage account name

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `location` | Azure region | East US |
| `resource_group_name` | Resource group name | react-upload-rg |
| `app_service_sku` | App Service Plan tier | B1 (free) |
| `frontend_origin` | CORS allowed origin | http://localhost:5173 |

See `variables.tf` for all options.

## Deploying the Python Backend

After infrastructure is created:

### 1. Prepare Backend Code

```bash
cd ../backend-python
zip -r backend.zip . -x "venv/*" "__pycache__/*" ".git/*"
```

### 2. Deploy via Azure CLI

```bash
az webapp deployment source config-zip \
  --resource-group react-upload-rg \
  --name <app-service-name> \
  --src backend.zip
```

Or use the Azure Portal / VS Code Azure App Service extension.

### 3. Verify Deployment

```bash
# Should return {"status": "ok"}
curl https://<app-service-name>.azurewebsites.net/health
```

## How Uploads Work

1. **Browser requests SAS token**: `POST /api/upload/sas` from frontend
2. **Backend generates SAS**: Signed by managed identity, valid 20 minutes
3. **Browser receives pre-signed URL**: Includes SAS token in query string
4. **Browser uploads directly to storage**: Via public CORS endpoint
5. **Storage validates SAS**: Verifies signature and blob-scoped permissions
6. **Upload succeeds**: File stored in `uploads` container

**Security**: SAS token is the only key required; storage account keys never exposed.

## CORS Configuration

Automatically configured by Terraform:

```
Allowed Methods: GET, HEAD, PUT, DELETE, POST, OPTIONS, PATCH, MERGE
Allowed Origins: <frontend_origin>, http://localhost:5173, http://127.0.0.1:5173
Allowed Headers: * (all)
Exposed Headers: Content-Length, ETag, x-ms-version
Max Age: 3600 seconds
```

## Monitoring & Troubleshooting

### Check Backend Connectivity

```bash
# View logs
az webapp log tail --resource-group react-upload-rg --name <app-service-name>

# Test health endpoint
curl https://<app-service-name>.azurewebsites.net/health
```

### Test CORS

```bash
# From your frontend, check CORS headers
curl -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: PUT" \
  -X OPTIONS \
  "https://<storage>.blob.core.windows.net/<container>/<blob>?<sas>"
```

### Common Issues

**"CORS error: Access-Control-Allow-Origin"**
- Verify `frontend_origin` in `terraform.tfvars` matches your actual frontend URL
- Check storage CORS rules in Azure Portal

**"This request is not authorized"**
- Ensure managed identity has Storage Blob Data Contributor role
- Check app settings: `AZURE_STORAGE_ACCOUNT_NAME`

**"Container/Blob not found"**
- Verify `uploads` container exists
- Check SAS token validity (not expired)

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

Type `yes` to confirm. ⚠️ **This deletes storage account and all uploads**.

## Cost

- App Service B1: ~$12/month
- Storage Account (LRS): ~$0.25/month
- **Total: ~$12/month**

Upgrade to P1V2+ for production workloads.

## Production Considerations

1. **Terraform State**: Store in Azure Blob Storage backend, not local `.tfstate`
2. **App Service Tier**: Use P1V2 or higher for production
3. **Storage Replication**: Use GRS (Geo-Redundant) instead of LRS
4. **Scaling**: Add auto-scale rules for traffic spikes
5. **Monitoring**: Enable Application Insights
6. **Custom Domain**: Use Azure Front Door + CDN
7. **CI/CD**: Integrate GitHub Actions or Azure Pipelines

## References

- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Azure App Service Documentation](https://learn.microsoft.com/en-us/azure/app-service/)
- [Azure Storage CORS](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-cors-resource-sharing)
- [Azure SAS Tokens](https://learn.microsoft.com/en-us/azure/storage/common/storage-sas-overview)
- [Azure Managed Identities](https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview)

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
