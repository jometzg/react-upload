import { Router } from 'express'
import { createUploadSas } from '../controllers/uploadController.js'

const router = Router()

router.post('/sas', createUploadSas)

export default router
