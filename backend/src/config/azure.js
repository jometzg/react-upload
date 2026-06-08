import { DefaultAzureCredential } from '@azure/identity'
import { BlobServiceClient } from '@azure/storage-blob'

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME

if (!accountName) {
  throw new Error('Missing AZURE_STORAGE_ACCOUNT_NAME in backend .env')
}

const serviceUrl = `https://${accountName}.blob.core.windows.net`
const credential = new DefaultAzureCredential()

export const blobServiceClient = new BlobServiceClient(serviceUrl, credential)
export const uploadsContainerName = process.env.AZURE_STORAGE_BLOB_CONTAINER_NAME || 'uploads'
export const maxFileSizeBytes = Number(process.env.MAX_FILE_SIZE_MB || 1024) * 1024 * 1024

export async function ensureUploadsContainer() {
  const containerClient = blobServiceClient.getContainerClient(uploadsContainerName)
  await containerClient.createIfNotExists()
}
