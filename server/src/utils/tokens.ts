import { createHash, randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export const createOpaqueToken = () => randomBytes(32).toString('base64url')

export function createAccessToken(userId: string, sessionId: string) {
  return jwt.sign({ type: 'access', sid: sessionId }, env.JWT_ACCESS_SECRET, { subject: userId, expiresIn: '10m' })
}

export function createRefreshToken(userId: string, sessionId: string) {
  return jwt.sign({ type: 'refresh', sid: sessionId }, env.JWT_REFRESH_SECRET, { subject: userId, expiresIn: '30d' })
}
