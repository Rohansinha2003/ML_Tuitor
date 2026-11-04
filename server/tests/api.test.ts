import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Types } from 'mongoose'
import { Bookmark } from '../src/models/Bookmark.js'
import { LessonProgress } from '../src/models/LessonProgress.js'
import { QuizAttempt } from '../src/models/QuizAttempt.js'
import { User } from '../src/models/User.js'

process.env.PORT = '5000'
process.env.NODE_ENV = 'test'
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/deepnova-test'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-more-than-thirty-two-bytes'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-more-than-thirty-two-bytes'
process.env.COOKIE_SECURE = 'false'
process.env.SMTP_USER = ''
process.env.SMTP_PASSWORD = ''
process.env.EMAIL_FROM = ''
process.env.GOOGLE_CLIENT_ID = ''
process.env.GOOGLE_CLIENT_SECRET = ''

let app: (typeof import('../src/app.js'))['app']
beforeAll(async () => {
  app = (await import('../src/app.js')).app
})

describe('API security boundaries', () => {
  it('reports degraded health when the database is not connected', async () => {
    const response = await request(app).get('/api/health').expect(503)
    expect(response.body.data).toMatchObject({ status: 'degraded', database: 'disconnected', google: false, email: false })
  })

  it('only trusts its own origins for credentialed requests', async () => {
    const { isTrustedOrigin } = await import('../src/middleware/origin.js')
    expect(isTrustedOrigin('http://localhost:5173')).toBe(true)
    expect(isTrustedOrigin('https://ml-tuitor.vercel.app')).toBe(true)
    expect(isTrustedOrigin('https://attacker.vercel.app')).toBe(false)
    expect(isTrustedOrigin('https://ml-tuitor.vercel.app.evil.com')).toBe(false)
  })

  it('accepts a same-origin refresh attempt and rejects other origins', async () => {
    await request(app).post('/api/auth/refresh').set('Origin', 'https://attacker.vercel.app').expect(403)
    await request(app).post('/api/auth/refresh').set('Origin', 'http://localhost:5173').expect(401)
  })

  it('sends Google sign-in back to the login page when it is not configured', async () => {
    const response = await request(app).get('/api/auth/google').expect(302)
    expect(response.headers.location).toBe('http://localhost:5173/login?error=google_unavailable')
  })

  it('rejects private progress requests without an access token', async () => {
    const response = await request(app).get('/api/progress').expect(401)
    expect(response.body.error).toBe('Authentication required')
  })

  it('validates signup before any database operation', async () => {
    const response = await request(app).post('/api/auth/signup').send({
      name: 'Learner', email: 'not-an-email', password: 'short', confirmPassword: 'different',
    }).expect(400)
    expect(response.body.error).toBe('Invalid request')
    expect(response.body.details.length).toBeGreaterThan(0)
  })

  it('reports missing SMTP configuration for password reset', async () => {
    const response = await request(app).post('/api/auth/forgot-password').send({ email: 'unknown@example.com' }).expect(503)
    expect(response.body.error).toBe('Password reset email is not configured on the server')
  })

  it('rejects refresh-cookie operations without the configured origin', async () => {
    await request(app).post('/api/auth/refresh').expect(403)
  })

  it('does not select password hashes by default', () => {
    expect(User.schema.path('passwordHash').options.select).toBe(false)
  })

  it('enforces per-user progress and bookmark uniqueness in schema indexes', () => {
    const progressIndexes = LessonProgress.schema.indexes()
    const bookmarkIndexes = Bookmark.schema.indexes()
    expect(progressIndexes.some(([keys, options]) => keys.userId === 1 && keys.lessonSlug === 1 && options.unique)).toBe(true)
    expect(bookmarkIndexes.some(([keys, options]) => keys.userId === 1 && keys.lessonSlug === 1 && options.unique)).toBe(true)
  })

  it('rejects quiz scores greater than their question count', async () => {
    const attempt = new QuizAttempt({ userId: new Types.ObjectId(), lessonSlug: 'neural-networks', score: 2, totalQuestions: 1 })
    await expect(attempt.validate()).rejects.toThrow(/Score cannot exceed total questions/)
  })
})
