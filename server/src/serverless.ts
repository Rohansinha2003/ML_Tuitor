import type { IncomingMessage, ServerResponse } from 'node:http'
import { app } from './app.js'
import { connectDatabase } from './database.js'
import { env } from './config/env.js'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await connectDatabase(env.MONGODB_URI)
  } catch (error) {
    console.error('MongoDB is unavailable for API request:', error instanceof Error ? error.message : String(error))
    // The health route explains the failure itself; everything else needs the database.
    if (!req.url?.startsWith('/api/health')) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Database is unavailable. Please try again later.' }))
      return
    }
  }
  return app(req, res)
}

export { app }
