import type { RequestHandler } from 'express'
import { env } from '../config/env.js'
import { HttpError } from './errorHandler.js'

export const requireClientOrigin: RequestHandler = (request, _response, next) => {
  const origin = request.get('origin')
  const isAllowed =
    origin &&
    (origin === env.CLIENT_ORIGIN ||
      origin === 'https://ml-tuitor.vercel.app' ||
      (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`) ||
      origin.endsWith('.vercel.app'))

  if (!isAllowed) {
    next(new HttpError(403, 'Request origin is not allowed'))
    return
  }
  next()
}
