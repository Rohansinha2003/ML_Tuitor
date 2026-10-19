import { app } from './app.js'
import { env } from './config/env.js'
import { connectDatabase, disconnectDatabase } from './database.js'

async function start() {
  await connectDatabase(env.MONGODB_URI)
  const server = app.listen(env.PORT, () => {
    console.info(`MLVerse API listening on port ${env.PORT}`)
  })
  let shuttingDown = false
  const shutdown = async () => {
    if (shuttingDown) return
    shuttingDown = true
    server.close(async () => {
      await disconnectDatabase()
      process.exit(0)
    })
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

start().catch((error: unknown) => {
  console.error('MLVerse API failed to start', error instanceof Error ? error.message : 'Unknown error')
  process.exit(1)
})
