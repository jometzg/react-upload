import { useEffect, useMemo, useRef, useState } from 'react'
import { BlockBlobClient } from '@azure/storage-blob'
import Uppy from '@uppy/core'
import Dashboard from '@uppy/react/dashboard'
import GoldenRetriever from '@uppy/golden-retriever'
import '@uppy/core/css/style.min.css'
import '@uppy/dashboard/css/style.min.css'
import { requestUploadSas } from './services/uploadService'
import './App.css'

const BLOCK_SIZE = 8 * 1024 * 1024
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024

function App() {
  const [error, setError] = useState('')
  const [uploadedBlobs, setUploadedBlobs] = useState([])
  const fileInputRef = useRef(null)

  const uppy = useMemo(() => {
    const uploader = new Uppy({
      autoProceed: true,
      restrictions: {
        maxFileSize: 5 * 1024 * 1024 * 1024,
      },
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
    })

    uploader.use(GoldenRetriever)

    uploader.addUploader(async (fileIDs) => {
      await Promise.all(
        fileIDs.map(async (fileID) => {
          const file = uploader.getFile(fileID)
          if (!file) {
            return
          }

          const fileName = file.name
          const fileSize = file.size
          const isLargeFile = fileSize > LARGE_FILE_THRESHOLD

          try {
            console.log(
              `[Upload] Starting ${isLargeFile ? 'large' : 'small'} file: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`,
            )

            const sas = await requestUploadSas({
              fileName: file.name,
              fileSize: file.size,
              contentType: file.type || 'application/octet-stream',
            })

            console.log(`[Upload] Got SAS token for ${fileName}, expires: ${sas.expiresOn}`)

            uploader.setFileMeta(fileID, {
              blobName: sas.blobName,
              sasExpiryUtc: sas.expiresOn,
            })

            if (isLargeFile) {
              // Use BlockBlobClient for large files (chunked upload)
              console.log(`[Upload] Using BlockBlobClient for ${fileName}`)
              const blobClient = new BlockBlobClient(sas.uploadUrl)
              const uploadStartedAt = Date.now()
              let lastProgressTime = uploadStartedAt

              // Must set uploadStarted in file state before emitting progress events,
              // otherwise Uppy core's calculateProgress handler ignores them.
              uploader.setFileState(fileID, {
                progress: { uploadStarted: uploadStartedAt, uploadComplete: false, percentage: 0, bytesUploaded: 0, bytesTotal: fileSize },
              })

              await blobClient.uploadBrowserData(file.data, {
                blockSize: BLOCK_SIZE,
                maxSingleShotSize: BLOCK_SIZE,
                concurrency: 2,
                blobHTTPHeaders: {
                  blobContentType: file.type || 'application/octet-stream',
                },
                onProgress: ({ loadedBytes }) => {
                  const now = Date.now()
                  if (now - lastProgressTime > 2000) {
                    console.log(
                      `[Upload] ${fileName} progress: ${(loadedBytes / 1024 / 1024).toFixed(2)}MB / ${(fileSize / 1024 / 1024).toFixed(2)}MB`,
                    )
                    lastProgressTime = now
                  }

                  const currentFile = uploader.getFile(fileID)
                  if (!currentFile) {
                    return
                  }

                  uploader.emit('upload-progress', currentFile, {
                    uploadStarted: currentFile.progress.uploadStarted || uploadStartedAt,
                    bytesUploaded: loadedBytes,
                    bytesTotal: file.size,
                  })
                },
              })
            } else {
              // Use simple XHR for small files
              console.log(`[Upload] Using XHR for ${fileName}`)
              const uploadStartedAt = Date.now()

              // Must set uploadStarted before emitting progress events
              uploader.setFileState(fileID, {
                progress: { uploadStarted: uploadStartedAt, uploadComplete: false, percentage: 0, bytesUploaded: 0, bytesTotal: fileSize },
              })

              const xhr = new XMLHttpRequest()
              const uploadPromise = new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (event) => {
                  if (event.lengthComputable) {
                    const currentFile = uploader.getFile(fileID)
                    if (currentFile) {
                      uploader.emit('upload-progress', currentFile, {
                        uploadStarted: uploadStartedAt,
                        bytesUploaded: event.loaded,
                        bytesTotal: event.total,
                      })
                    }
                  }
                })

                xhr.addEventListener('load', () => {
                  if (xhr.status === 201) {
                    console.log(`[Upload] XHR completed for ${fileName}`)
                    resolve()
                  } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`))
                  }
                })

                xhr.addEventListener('error', () => {
                  reject(new Error('XHR network error'))
                })

                xhr.addEventListener('abort', () => {
                  reject(new Error('XHR aborted'))
                })

                xhr.open('PUT', sas.uploadUrl)
                xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob')
                xhr.send(file.data)
              })

              await uploadPromise
            }

            const currentFile = uploader.getFile(fileID)
            if (!currentFile) {
              return
            }

            console.log(`[Upload] Success: ${fileName}`)
            uploader.emit('upload-success', currentFile, {
              status: 201,
              body: {
                url: sas.uploadUrl,
              },
              uploadURL: sas.uploadUrl,
            })
          } catch (uploadError) {
            console.error(`[Upload] Error for ${fileName}:`, uploadError)
            const currentFile = uploader.getFile(fileID)
            if (currentFile) {
              uploader.emit('upload-error', currentFile, uploadError)
            }
          }
        }),
      )
    })

    return uploader
  }, [])

  useEffect(() => {
    const onFileAdded = () => {
      setError('')
    }

    const onUploadSuccess = (file, response) => {
      setUploadedBlobs((current) => {
        const item = {
          id: file.id,
          name: file.name,
          blobName: file.meta.blobName,
          statusCode: response?.status,
        }
        return [item, ...current].slice(0, 5)
      })
    }

    const onUploadError = (file, uploadError) => {
      setError(uploadError?.message || 'Upload failed')
    }

    uppy.on('file-added', onFileAdded)
    uppy.on('upload-success', onUploadSuccess)
    uppy.on('upload-error', onUploadError)

    return () => {
      uppy.off('file-added', onFileAdded)
      uppy.off('upload-success', onUploadSuccess)
      uppy.off('upload-error', onUploadError)
    }
  }, [uppy])

  useEffect(() => {
    return () => uppy.destroy()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onChooseClick = () => {
    fileInputRef.current?.click()
  }

  const onFileInputChange = (event) => {
    const files = Array.from(event.target.files || [])

    files.forEach((file) => {
      try {
        uppy.addFile({
          name: file.name,
          type: file.type,
          data: file,
          source: 'file-input',
        })
      } catch (addError) {
        setError(addError?.message || 'Could not add file')
      }
    })

    event.target.value = ''
  }

  return (
    <main className="page">
      <section className="card">
        <h1>Azure Blob Uploader</h1>
        <p className="subtitle">
          Drag and drop a file or browse to upload directly to the <strong>uploads</strong>{' '}
          container using short-lived SAS URLs.
        </p>

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="actions">
          <button type="button" className="pick-btn" onClick={onChooseClick}>
            Choose File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden-input"
            onChange={onFileInputChange}
          />
        </div>

        <Dashboard
          uppy={uppy}
          proudlyDisplayPoweredByUppy={false}
          note="Large uploads supported with retry/recovery"
          height={390}
          width="100%"
        />
      </section>

      <section className="card uploads">
        <h2>Recent Uploads</h2>
        {uploadedBlobs.length === 0 ? (
          <p className="muted">No uploads yet.</p>
        ) : (
          <ul>
            {uploadedBlobs.map((upload) => (
              <li key={upload.id}>
                <span>{upload.name}</span>
                <code>{upload.blobName}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
