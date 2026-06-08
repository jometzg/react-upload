import { useEffect, useMemo, useRef, useState } from 'react'
import Uppy from '@uppy/core'
import Dashboard from '@uppy/react/dashboard'
import XHRUpload from '@uppy/xhr-upload'
import GoldenRetriever from '@uppy/golden-retriever'
import '@uppy/core/css/style.min.css'
import '@uppy/dashboard/css/style.min.css'
import { requestUploadSas } from './services/uploadService'
import './App.css'

function App() {
  const [error, setError] = useState('')
  const [uploadedBlobs, setUploadedBlobs] = useState([])
  const fileInputRef = useRef(null)

  const uppy = useMemo(() => {
    return new Uppy({
      autoProceed: true,
      restrictions: {
        maxFileSize: 5 * 1024 * 1024 * 1024,
      },
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
    })
      .use(GoldenRetriever)
      .use(XHRUpload, {
        formData: false,
        method: 'PUT',
        limit: 4,
        headers: {
          'x-ms-blob-type': 'BlockBlob',
        },
        async endpoint(file) {
          try {
            const sas = await requestUploadSas({
              fileName: file.name,
              fileSize: file.size,
              contentType: file.type || 'application/octet-stream',
            })
            return sas.uploadUrl
          } catch (err) {
            throw new Error(`SAS request failed: ${err.message}`)
          }
        },
      })
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
