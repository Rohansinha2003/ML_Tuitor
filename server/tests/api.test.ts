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

let app: (typeof import('../src/app.js'))['app']
beforeAll(async () => {
  app = (await import('../src/app.js')).app
})

describe('API security boundaries', () => {
  it('reports health without claiming a database connection', async () => {
    const response = await request(app).get('/api/health').expect(200)
    expect(response.body.data.status).toBe('ok')
    expect(['connected', 'disconnected']).toContain(response.body.data.database)
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

  it('returns the same generic forgot-password response without SMTP', async () => {
    const response = await request(app).post('/api/auth/forgot-password').send({ email: 'unknown@example.com' }).expect(200)
    expect(response.body.data.message).toBe('If an account exists for that email, password reset instructions will be sent.')
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
