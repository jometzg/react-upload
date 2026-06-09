## Quick Start for Terraform Deployment

### Prerequisites
- Terraform 1.0+ ([download](https://www.terraform.io/downloads.html))
- Azure CLI (`az` command) - logged in with `az login`
- Permission to create resources in your Azure subscription

### 5-Minute Setup

```bash
cd terraform

# 1. Copy and edit variables
cp terraform.tfvars.example terraform.tfvars
# Edit: change app_service_name and storage_account_name to unique values

# 2. Initialize Terraform
terraform init

# 3. Review what will be created
terraform plan

# 4. Deploy infrastructure
terraform apply
# Type 'yes' to confirm

# 5. Get outputs (app URL, storage name, etc.)
terraform output
```

### What Gets Created

✅ Resource Group  
✅ Virtual Network (10.0.0.0/16) with 2 subnets  
✅ Private Storage Account (no public internet access)  
✅ Storage "uploads" container  
✅ Private Endpoint for secure storage access  
✅ Linux App Service (B1 tier = free)  
✅ Managed Identity for App Service  
✅ Storage Blob Data Contributor role assignment  

### Cost Estimate (B1 tier, LRS storage)
- App Service Plan B1: ~$12/month
- Storage Account: ~$0.25/month (minimal upload traffic)
- VNet/Private Endpoint: Free
- **Total: ~$12/month**

### After Deployment

1. Deploy Python backend to App Service:
   ```bash
   cd ../backend-python
   zip -r backend.zip . -x "venv/*" "__pycache__/*" ".git/*"
   az webapp deployment source config-zip \
     --resource-group react-upload-rg \
     --name $(terraform output -raw app_service_name | cut -d. -f1) \
     --src backend.zip
   ```

2. Update React frontend to call the new API URL (from `terraform output app_service_default_hostname`)

3. Deploy React frontend (to Azure Static Web Apps or your CDN)

### Cleanup

```bash
terraform destroy
# Type 'yes' to confirm - THIS DELETES EVERYTHING
```

### For Production

See `README.md` for:
- Remote Terraform state in Azure Storage
- Auto-scaling configuration
- Monitoring setup
- Custom domains
- CI/CD integration

---

**Need help?** See the full [README.md](README.md) in this directory.
