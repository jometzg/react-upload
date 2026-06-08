import { randomUUID } from 'node:crypto'
import {
  BlobSASPermissions,
  SASProtocol,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob'
import { blobServiceClient, maxFileSizeBytes, uploadsContainerName } from '../config/azure.js'

const sasLifetimeMinutes = Number(process.env.SAS_EXPIRY_MINUTES || 20)

function sanitizeBaseName(fileName) {
  const withoutPath = String(fileName || 'upload.bin').split(/[\\/]/).pop()
  return withoutPath.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function buildBlobName(fileName) {
  const cleanName = sanitizeBaseName(fileName)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `${timestamp}-${randomUUID()}-${cleanName}`
}

export async function createUploadSas(req, res, next) {
  try {
    const { fileName, fileSize, contentType } = req.body || {}

    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({ error: 'fileName is required' })
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return res.status(400).json({ error: 'fileSize must be a positive number' })
    }

    if (fileSize > maxFileSizeBytes) {
      return res.status(400).json({
        error: `fileSize exceeds MAX_FILE_SIZE_MB (${Math.floor(maxFileSizeBytes / (1024 * 1024))} MB)`,
      })
    }

    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
    const blobName = buildBlobName(fileName)

    const startsOn = new Date(Date.now() - 5 * 60 * 1000)
    const expiresOn = new Date(Date.now() + sasLifetimeMinutes * 60 * 1000)

    const delegationKey = await blobServiceClient.getUserDelegationKey(startsOn, expiresOn)

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: uploadsContainerName,
        blobName,
        permissions: BlobSASPermissions.parse('cw'),
        startsOn,
        expiresOn,
        protocol: SASProtocol.Https,
        // No contentType constraint — any Content-Type header is accepted.
        // A constraint here would require the browser to send an exact match
        // which is fragile and causes silent 403s.
      },
      delegationKey,
      accountName,
    ).toString()

    const uploadUrl = `https://${accountName}.blob.core.windows.net/${uploadsContainerName}/${blobName}?${sasToken}`

    return res.json({
      uploadUrl,
      blobName,
      containerName: uploadsContainerName,
      expiresOn: expiresOn.toISOString(),
    })
  } catch (error) {
    return next(error)
  }
}
