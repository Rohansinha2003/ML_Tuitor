import { app } from './app.js'
import { env } from './config/env.js'
import { connectDatabase, disconnectDatabase } from './database.js'

async function resolveMongoUri(): Promise<string> {
  if (env.MONGODB_URI) return env.MONGODB_URI
  if (env.NODE_ENV === 'production') throw new Error('MONGODB_URI is required in production')
  // In development, use an in-memory MongoDB server when no URI is configured
  const { MongoMemoryServer } = await import('mongodb-memory-server')
  const memServer = await MongoMemoryServer.create()
  console.info('⚡ Using in-memory MongoDB (data will not persist across restarts)')
  return memServer.getUri()
}

async function start() {
  const mongoUri = await resolveMongoUri()
  await connectDatabase(mongoUri)
  const server = app.listen(env.PORT, () => {
    console.info(`DeepNova API listening on port ${env.PORT}`)
    console.info(`Google sign-in: ${env.googleConfigured ? `enabled, callback ${env.GOOGLE_CALLBACK_URL}` : 'not configured'}`)
    console.info(`Email delivery: ${env.emailConfigured ? 'enabled' : 'not configured'}`)
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
  console.error('DeepNova API failed to start:', error instanceof Error ? error.message : 'Unknown error')
  process.exit(1)
})
