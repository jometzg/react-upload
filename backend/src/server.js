import app from './app.js'
import { ensureUploadsContainer } from './config/azure.js'

const port = Number(process.env.PORT || 3000)

async function start() {
  await ensureUploadsContainer()

  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`)
  })
}

start().catch((error) => {
  console.error('Backend startup failed', error)
  process.exit(1)
})
