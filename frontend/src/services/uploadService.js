const baseApiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export async function requestUploadSas({ fileName, fileSize, contentType }) {
  const response = await fetch(`${baseApiUrl}/upload/sas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName,
      fileSize,
      contentType,
    }),
  })

  if (!response.ok) {
    let message = `Failed to create upload token (${response.status})`
    try {
      const body = await response.json()
      if (body?.error) {
        message = body.error
      }
    } catch {
      // Ignore parsing errors and keep fallback message.
    }

    throw new Error(message)
  }

  return response.json()
}