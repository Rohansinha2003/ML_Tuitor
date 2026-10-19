import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ error: 'Invalid request', details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) })
    return
  }
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message })
    return
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
    response.status(409).json({ error: 'A record with those details already exists' })
    return
  }
  console.error('Unhandled API error', error instanceof Error ? error.message : 'Unknown error')
  response.status(500).json({ error: 'An unexpected server error occurred' })
}
