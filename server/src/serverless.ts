import type { IncomingMessage, ServerResponse } from 'node:http'
import { app } from './app.js'
import { connectDatabase } from './database.js'
import { env } from './config/env.js'

let isConnected = false
let connectionPromise: Promise<void> | null = null

async function ensureDatabase(): Promise<void> {
  if (isConnected) return
  if (!connectionPromise) {
    if (!env.MONGODB_URI) {
      return
    }
    connectionPromise = connectDatabase(env.MONGODB_URI)
      .then(() => {
        isConnected = true
      })
      .catch((err) => {
        connectionPromise = null
        console.error('MongoDB connection error in serverless handler:', err instanceof Error ? err.message : err)
      })
  }
  return connectionPromise
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ensureDatabase().catch(() => {})
  return app(req, res)
}

export { app }
