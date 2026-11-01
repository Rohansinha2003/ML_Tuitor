import { Router, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { env } from '../config/env.js'
import { Session } from '../models/Session.js'
import { User } from '../models/User.js'
import { authenticate } from '../middleware/authenticate.js'
import { HttpError } from '../middleware/errorHandler.js'
import { requireClientOrigin } from '../middleware/origin.js'
import { validateBody } from '../middleware/validate.js'
import { changePasswordSchema, forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema, verifyEmailSchema } from '../validators/schemas.js'
import { createAccessToken, createOpaqueToken, createRefreshToken, hashToken } from '../utils/tokens.js'
import { sendAccountEmail, sendPasswordResetEmail, sendWelcomeEmail, sendWelcomeVerificationEmail } from '../utils/email.js'

export const authRouter = Router()
const refreshCookieName = 'deepnova_refresh'
const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false })
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false })
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false })
const googleStateCookieName = 'deepnova_google_state'
const googleClient = env.googleConfigured ? new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL) : null

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

function safeReturnTo(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
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
      await sendWelcomeVerificationEmail(email, name, verificationToken)
    } catch {
      await User.deleteOne({ _id: user._id })
      throw new HttpError(503, 'Email verification is temporarily unavailable. Please try again later.')
    }
    response.status(201).json({ data: { user: safeUser(user), requiresEmailVerification: true } })
    return
  }
  if (env.emailConfigured) {
    try {
      await sendWelcomeEmail(email, name)
    } catch (error) {
      console.warn('Welcome email delivery failed:', error instanceof Error ? error.message : 'Unknown error')
    }
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
  if (env.emailConfigured) {
    try {
      await sendWelcomeEmail(user.email, user.name)
    } catch (error) {
      console.warn('Welcome confirmation email delivery failed:', error instanceof Error ? error.message : 'Unknown error')
    }
  }
  response.json({ data: { user: safeUser(user) } })
})

authRouter.post('/login', loginLimiter, validateBody(loginSchema), async (request, response) => {
  const { email, password } = request.body as { email: string; password: string }
  const user = await User.findOne({ email }).select('+passwordHash')
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Email or password is incorrect')
  if (env.emailConfigured && !user.emailVerified) throw new HttpError(403, 'Verify your email before signing in')
  const accessToken = await issueSession(user.id, response)
  response.json({ data: { user: safeUser(user), accessToken } })
})

authRouter.get('/google', (request, response) => {
  if (!googleClient) throw new HttpError(503, 'Google sign-in is not configured on the server')
  const state = createOpaqueToken()
  const returnTo = safeReturnTo(request.query.returnTo)
  response.cookie(googleStateCookieName, `${state}.${Buffer.from(returnTo).toString('base64url')}`, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/api/auth/google',
  })
  response.redirect(googleClient.generateAuthUrl({ access_type: 'offline', scope: ['openid', 'email', 'profile'], state, prompt: 'select_account' }))
})

authRouter.get('/google/callback', async (request, response) => {
  if (!googleClient) throw new HttpError(503, 'Google sign-in is not configured on the server')
  const storedState = request.cookies?.[googleStateCookieName]
  const [expectedState, encodedReturnTo] = typeof storedState === 'string' ? storedState.split('.') : []
  const returnTo = safeReturnTo(encodedReturnTo ? Buffer.from(encodedReturnTo, 'base64url').toString('utf8') : '/')
  response.clearCookie(googleStateCookieName, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax', path: '/api/auth/google' })
  if (!request.query.state || typeof request.query.state !== 'string' || request.query.state !== expectedState) throw new HttpError(400, 'Google sign-in state is invalid')
  if (typeof request.query.code !== 'string') throw new HttpError(400, 'Google did not return an authorization code')
  const { tokens } = await googleClient.getToken(request.query.code)
  const ticket = await googleClient.verifyIdToken({ idToken: tokens.id_token!, audience: env.GOOGLE_CLIENT_ID })
  const profile = ticket.getPayload()
  if (!profile?.sub || !profile.email || profile.email_verified !== true) throw new HttpError(400, 'Google did not provide a verified email address')
  const existing = await User.findOne({ email: profile.email.toLowerCase() }).select('+passwordHash +googleId')
  if (existing && existing.googleId !== profile.sub) throw new HttpError(409, 'An account with this email already exists. Sign in with your password first.')
  const isNewUser = !existing
  const user = existing ?? await User.create({ name: profile.name?.trim() || profile.email.split('@')[0], email: profile.email.toLowerCase(), googleId: profile.sub, authProvider: 'google', emailVerified: true, avatarUrl: profile.picture ?? null })
  if (!user.googleId) { user.googleId = profile.sub; user.authProvider = 'google'; user.emailVerified = true; await user.save() }
  if (isNewUser && env.emailConfigured) {
    try {
      await sendWelcomeEmail(user.email, user.name)
    } catch (error) {
      console.warn('Welcome email delivery failed for Google user:', error instanceof Error ? error.message : 'Unknown error')
    }
  }
  await issueSession(user.id, response)
  response.redirect(`${env.CLIENT_ORIGIN}${returnTo}`)
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
  if (!env.emailConfigured) throw new HttpError(503, 'Password reset email is not configured on the server')
  const user = await User.findOne({ email }).select('+resetTokenHash +resetExpiresAt')
  if (user) {
    const token = createOpaqueToken()
    user.resetTokenHash = hashToken(token)
    user.resetExpiresAt = new Date(Date.now() + 30 * 60 * 1000)
    await user.save()
    try {
      await sendPasswordResetEmail(email, token)
    } catch (error) {
      user.resetTokenHash = undefined
      user.resetExpiresAt = undefined
      await user.save()
      console.error('Password reset email delivery failed', error instanceof Error ? error.message : 'Unknown error')
      throw new HttpError(503, 'Password reset email delivery is temporarily unavailable. Please try again later.')
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
  if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new HttpError(401, 'Current password is incorrect')
  user.passwordHash = await bcrypt.hash(password, 12)
  user.passwordChangedAt = new Date()
  await user.save()
  await Session.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } })
  clearRefreshCookie(response)
  response.json({ data: { message: 'Password changed. Sign in again on your devices.' } })
})
