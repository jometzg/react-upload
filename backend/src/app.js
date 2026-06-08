import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import morgan from 'morgan'
import uploadRoutes from './routes/uploadRoutes.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

const app = express()

const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'

app.use(morgan('dev'))
app.use(express.json({ limit: '1mb' }))
app.use(
  cors({
    origin: frontendOrigin,
    methods: ['GET', 'POST'],
    credentials: false,
  }),
)

const sasLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: Number(process.env.SAS_RATE_LIMIT_PER_MINUTE || 30),
  standardHeaders: true,
  legacyHeaders: false,
})

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use('/api/upload', sasLimiter, uploadRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
