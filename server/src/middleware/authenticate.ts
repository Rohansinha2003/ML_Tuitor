import type { RequestHandler } from 'express'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { env } from '../config/env.js'
import { Session } from '../models/Session.js'
import { HttpError } from './errorHandler.js'

export const authenticate: RequestHandler = async (request, _response, next) => {
  const [scheme, token] = (request.get('authorization') ?? '').split(' ')
  if (scheme !== 'Bearer' || !token) {
    next(new HttpError(401, 'Authentication required'))
    return
  }
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload
    if (payload.type !== 'access' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') throw new Error('Invalid access token')
    const session = await Session.exists({ _id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { $gt: new Date() } })
    if (!session) throw new Error('Session revoked')
    request.auth = { userId: payload.sub, sessionId: payload.sid }
    next()
  } catch {
    next(new HttpError(401, 'Session expired; sign in again'))
  }
}
