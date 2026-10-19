import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { authRouter } from './routes/auth.js'
import { progressRouter } from './routes/progress.js'
import { bookmarkRouter } from './routes/bookmarks.js'
import { noteRouter } from './routes/notes.js'
import { quizRouter } from './routes/quizzes.js'

export const app = express()
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }))
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())
app.get('/api/health', (_request, response) => response.json({ data: { status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' } }))
app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/api/auth', authRouter)
app.use('/api/progress', progressRouter)
app.use('/api/bookmarks', bookmarkRouter)
app.use('/api/notes', noteRouter)
app.use('/api/quizzes/attempts', quizRouter)
app.use((_request, response) => response.status(404).json({ error: 'API route not found' }))
app.use(errorHandler)
