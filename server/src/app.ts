import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import { databaseStatus } from './database.js'
import { errorHandler } from './middleware/errorHandler.js'
import { isTrustedOrigin } from './middleware/origin.js'
import { authRouter } from './routes/auth.js'
import { progressRouter } from './routes/progress.js'
import { bookmarkRouter } from './routes/bookmarks.js'
import { noteRouter } from './routes/notes.js'
import { quizRouter } from './routes/quizzes.js'

export const app = express()
app.disable('x-powered-by')
// Vercel terminates TLS one hop in front of the function; rate limits need the real client IP.
if (process.env.VERCEL) app.set('trust proxy', 1)
app.use(helmet())

app.use(cors({
  origin: (origin, callback) => callback(null, !origin || isTrustedOrigin(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '256kb' }))
app.use(cookieParser())
app.get('/api/health', (_request, response) => {
  const database = databaseStatus()
  response.status(database.database === 'connected' ? 200 : 503).json({ data: {
    status: database.database === 'connected' ? 'ok' : 'degraded',
    ...database,
    google: env.googleConfigured,
    email: env.emailConfigured,
  } })
})
app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests. Please slow down and try again shortly.' } }))
app.use('/api/auth', authRouter)
app.use('/api/progress', progressRouter)
app.use('/api/bookmarks', bookmarkRouter)
app.use('/api/notes', noteRouter)
app.use('/api/quizzes/attempts', quizRouter)
app.use((_request, response) => response.status(404).json({ error: 'API route not found' }))
app.use(errorHandler)

export default app
