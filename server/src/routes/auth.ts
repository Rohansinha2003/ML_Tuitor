import { randomBytes } from 'node:crypto'
import { Router, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { env } from '../config/env.js'
import { Session } from '../models/Session.js'
import { User } from '../models/User.js'
import { authenticate } from '../middleware/authenticate.js'
import { HttpError } from '../middleware/errorHandler.js'
import { requireClientOrigin } from '../middleware/origin.js'
import { validateBody } from '../middleware/validate.js'
import { changePasswordSchema, forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema, verifyEmailSchema } from '../validators/schemas.js'
import { createAccessToken, createOpaqueToken, createRefreshToken, hashToken } from '../utils/tokens.js'
import { sendAccountEmail } from '../utils/email.js'

export const authRouter = Router()
const refreshCookieName = 'deepnova_refresh'
const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false })
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false })
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false })

function cookieOptions() {
  return { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'strict' as const, path: '/api/auth' }
}

function safeUser(user: { _id: { toString(): string }; name: string; email: string; avatarUrl?: string | null; emailVerified: boolean; createdAt: Date }) {
  return { id: user._id.toString(), name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? null, emailVerified: user.emailVerified, createdAt: user.createdAt }
}

async function issueSession(userId: string, response: Response) {
  const session = await Session.create({ userId, refreshTokenHash: 'pending', expiresAt: new Date(Date.now() + thirtyDaysMs) })
  const refreshToken = createRefreshToken(userId, session.id)
  session.refreshTokenHash = hashToken(refreshToken)
  await session.save()
  response.cookie(refreshCookieName, refreshToken, { ...cookieOptions(), maxAge: thirtyDaysMs })
  return createAccessToken(userId, session.id)
}

function clearRefreshCookie(response: Response) {
  response.clearCookie(refreshCookieName, cookieOptions())
}

function verifyRefreshToken(token: string): JwtPayload & { sub: string; sid: string; type: 'refresh' } {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET)
  if (typeof payload === 'string' || payload.type !== 'refresh' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
    throw new HttpError(401, 'Session expired; sign in again')
  }
  return payload as JwtPayload & { sub: string; sid: string; type: 'refresh' }
}

authRouter.post('/signup', signupLimiter, validateBody(signupSchema), async (request, response) => {
  const { name, email, password } = request.body as { name: string; email: string; password: string }
  const verificationToken = env.emailConfigured ? createOpaqueToken() : undefined
  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 12),
    emailVerified: !env.emailConfigured,
    ...(verificationToken ? { verificationTokenHash: hashToken(verificationToken), verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } : {}),
  })
  if (verificationToken) {
    try {
      await sendAccountEmail(email, 'Verify your DeepNova account', `Open this link within 24 hours to verify your email: ${env.CLIENT_ORIGIN}/verify-email?token=${verificationToken}`)
    } catch {
      await User.deleteOne({ _id: user._id })
      throw new HttpError(503, 'Email verification is temporarily unavailable. Please try again later.')
    }
    response.status(201).json({ data: { user: safeUser(user), requiresEmailVerification: true } })
    return
  }
  const accessToken = await issueSession(user.id, response)
  response.status(201).json({ data: { user: safeUser(user), accessToken, requiresEmailVerification: false } })
})

authRouter.post('/verify-email', validateBody(verifyEmailSchema), async (request, response) => {
  const { token } = request.body as { token: string }
  const user = await User.findOneAndUpdate(
    { verificationTokenHash: hashToken(token), verificationExpiresAt: { $gt: new Date() } },
    { $set: { emailVerified: true }, $unset: { verificationTokenHash: 1, verificationExpiresAt: 1 } },
    { new: true },
  )
  if (!user) throw new HttpError(400, 'Verification link is invalid or expired')
  response.json({ data: { user: safeUser(user) } })
})

authRouter.post('/login', loginLimiter, validateBody(loginSchema), async (request, response) => {
  const { email, password } = request.body as { email: string; password: string }
  const user = await User.findOne({ email }).select('+passwordHash')
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Email or password is incorrect')
  if (env.emailConfigured && !user.emailVerified) throw new HttpError(403, 'Verify your email before signing in')
  const accessToken = await issueSession(user.id, response)
  response.json({ data: { user: safeUser(user), accessToken } })
})

authRouter.post('/refresh', requireClientOrigin, async (request, response) => {
  const token = request.cookies?.[refreshCookieName]
  if (typeof token !== 'string') throw new HttpError(401, 'Session expired; sign in again')
  let payload: JwtPayload & { sub: string; sid: string; type: 'refresh' }
  try { payload = verifyRefreshToken(token) } catch { clearRefreshCookie(response); throw new HttpError(401, 'Session expired; sign in again') }
  const oldHash = hashToken(token)
  const replacement = createRefreshToken(payload.sub, payload.sid)
  const result = await Session.updateOne(
    { _id: payload.sid, userId: payload.sub, refreshTokenHash: oldHash, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { refreshTokenHash: hashToken(replacement), rotatedAt: new Date() } },
  )
  if (result.modifiedCount !== 1) {
    await Session.updateOne({ _id: payload.sid, userId: payload.sub, revokedAt: null }, { $set: { revokedAt: new Date() } })
    clearRefreshCookie(response)
    throw new HttpError(401, 'Session expired; sign in again')
  }
  response.cookie(refreshCookieName, replacement, { ...cookieOptions(), maxAge: thirtyDaysMs })
  response.json({ data: { accessToken: createAccessToken(payload.sub, payload.sid) } })
})

authRouter.post('/logout', requireClientOrigin, async (request, response) => {
  const token = request.cookies?.[refreshCookieName]
  if (typeof token === 'string') {
    try {
      const payload = verifyRefreshToken(token)
      await Session.updateOne({ _id: payload.sid, userId: payload.sub, refreshTokenHash: hashToken(token), revokedAt: null }, { $set: { revokedAt: new Date() } })
    } catch { /* Logout remains idempotent for expired or malformed cookies. */ }
  }
  clearRefreshCookie(response)
  response.json({ data: { loggedOut: true } })
})

authRouter.get('/me', authenticate, async (request, response) => {
  const user = await User.findById(request.auth!.userId)
  if (!user) throw new HttpError(401, 'Account no longer exists')
  response.json({ data: { user: safeUser(user) } })
})

authRouter.post('/forgot-password', resetLimiter, validateBody(forgotPasswordSchema), async (request, response) => {
  const { email } = request.body as { email: string }
  const user = env.emailConfigured ? await User.findOne({ email }).select('+resetTokenHash +resetExpiresAt') : null
  if (user && env.emailConfigured) {
    const token = createOpaqueToken()
    user.resetTokenHash = hashToken(token)
    user.resetExpiresAt = new Date(Date.now() + 30 * 60 * 1000)
    await user.save()
    try {
      await sendAccountEmail(email, 'Reset your DeepNova password', `Open this link within 30 minutes to reset your password: ${env.CLIENT_ORIGIN}/reset-password?token=${token}`)
    } catch (error) {
      user.resetTokenHash = undefined
      user.resetExpiresAt = undefined
      await user.save()
      console.error('Password reset email delivery failed', error instanceof Error ? error.message : 'Unknown error')
    }
  }
  response.json({ data: { message: 'If an account exists for that email, password reset instructions will be sent.' } })
})

authRouter.post('/reset-password', resetLimiter, validateBody(resetPasswordSchema), async (request, response) => {
  const { token, password } = request.body as { token: string; password: string }
  const user = await User.findOneAndUpdate(
    { resetTokenHash: hashToken(token), resetExpiresAt: { $gt: new Date() } },
    { $set: { passwordHash: await bcrypt.hash(password, 12), passwordChangedAt: new Date() }, $unset: { resetTokenHash: 1, resetExpiresAt: 1 } },
    { new: true },
  )
  if (!user) throw new HttpError(400, 'Reset link is invalid or expired')
  await Session.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } })
  response.json({ data: { message: 'Password reset. You can now sign in with your new password.' } })
})

authRouter.patch('/change-password', authenticate, validateBody(changePasswordSchema), async (request, response) => {
  const { currentPassword, password } = request.body as { currentPassword: string; password: string }
  const user = await User.findById(request.auth!.userId).select('+passwordHash')
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new HttpError(401, 'Current password is incorrect')
  user.passwordHash = await bcrypt.hash(password, 12)
  user.passwordChangedAt = new Date()
  await user.save()
  await Session.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } })
  clearRefreshCookie(response)
  response.json({ data: { message: 'Password changed. Sign in again on your devices.' } })
})
