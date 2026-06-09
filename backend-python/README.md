# Python Azure Blob Upload Backend

Functionally equivalent FastAPI backend to the Node.js Express version. Generates short-lived SAS tokens for direct browser uploads to Azure Blob Storage.

## Setup

### 1. Create Virtual Environment

```bash
cd backend-python
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and set AZURE_STORAGE_ACCOUNT_NAME to your storage account name
```

## Run Locally

```bash
source venv/bin/activate  # If not already activated
python main.py
```

The server will start on `http://localhost:3000`.

## API Endpoints

### `POST /api/upload/sas`

Generate a short-lived SAS token for blob upload.

**Request body:**
```json
{
  "fileName": "my-file.zip",
  "fileSize": 104857600,
  "contentType": "application/zip"
}
```

**Response:**
```json
{
  "uploadUrl": "https://<account>.blob.core.windows.net/uploads/<blob>?<sas>",
  "blobName": "2026-...-uuid-my-file.zip",
  "containerName": "uploads",
  "expiresOn": "2026-06-08T00:00:00.000Z"
}
```

### `GET /health`

Health check endpoint.

## Configuration

Environment variables (in `.env`):

| Variable | Default | Purpose |
|---|---|---|
| `AZURE_STORAGE_ACCOUNT_NAME` | (required) | Azure storage account name |
| `AZURE_STORAGE_BLOB_CONTAINER_NAME` | `uploads` | Container name for uploads |
| `PORT` | `3000` | Server port |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS allowed origin (frontend URL) |
| `MAX_FILE_SIZE_MB` | `2048` | Maximum file size allowed |
| `SAS_EXPIRY_MINUTES` | `20` | SAS token expiration time |
| `SAS_RATE_LIMIT_PER_MINUTE` | `30` | Rate limit for SAS requests |

## Authentication

This backend uses `DefaultAzureCredential` from the Azure Identity SDK. It will:

1. **Local development**: Use credentials from `az login` (Azure CLI)
2. **Production (Azure-hosted)**: Use managed identity from the App Service

No storage account keys are needed in code or `.env`.

## Key Differences from Node Backend

- **Framework**: FastAPI + Uvicorn (async-first) instead of Express
- **HTTP Client**: Built-in `await request.json()` instead of Express body parser
- **Rate Limiting**: `slowapi` instead of `express-rate-limit`
- **CORS**: FastAPI middleware instead of `cors` package
- **Async Support**: Native async/await throughout
- **Port Binding**: `uvicorn` configuration instead of Node HTTP server

## Security

- Storage account keys are never sent to the client
- SAS tokens are scoped to one blob with create/write permissions only
- Tokens expire after 20 minutes (configurable)
- API is rate-limited to 30 requests per minute
- CORS restricted to frontend origin
