import type { RequestHandler } from 'express'
import { env } from '../config/env.js'
import { HttpError } from './errorHandler.js'

export const requireClientOrigin: RequestHandler = (request, _response, next) => {
  if (request.get('origin') !== env.CLIENT_ORIGIN) {
    next(new HttpError(403, 'Request origin is not allowed'))
    return
  }
  next()
}
