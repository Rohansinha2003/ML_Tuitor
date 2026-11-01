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
      throw new Error('MONGODB_URI is not configured')
    }
    connectionPromise = connectDatabase(env.MONGODB_URI)
      .then(() => {
        isConnected = true
      })
      .catch((err) => {
        connectionPromise = null
        const message = err instanceof Error ? err.message : String(err)
        console.error('MongoDB connection error in serverless handler:', message)
        throw new Error(`MongoDB connection failed: ${message}`)
      })
  }
  return connectionPromise
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await ensureDatabase()
  } catch (error) {
    console.error('MongoDB is unavailable for API request:', error instanceof Error ? error.message : String(error))
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      error: req.url?.startsWith('/api/health')
        ? 'Database is unavailable. Check the MONGODB_URI value and MongoDB Atlas network access.'
        : 'Database is unavailable. Please try again later.',
    }))
    return
  }
  return app(req, res)
}

export { app }
