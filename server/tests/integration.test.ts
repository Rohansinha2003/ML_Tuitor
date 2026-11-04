import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { MongoMemoryServer } from 'mongodb-memory-server'

const profile = { sub: 'google-sub-1', email: 'learner@example.com', email_verified: true, name: 'Google Learner', picture: 'https://example.com/a.png' as string | undefined }

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    generateAuthUrl({ state }: { state: string }) { return `https://accounts.google.com/o/oauth2/v2/auth?state=${state}` }
    async getToken(code: string) {
      if (code === 'bad') throw new Error('invalid_grant')
      return { tokens: { id_token: 'id-token' } }
    }
    async verifyIdToken() { return { getPayload: () => profile } }
  },
}))

process.env.NODE_ENV = 'test'
process.env.MONGODB_URI = ''
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-more-than-thirty-two-bytes'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-more-than-thirty-two-bytes'
process.env.COOKIE_SECURE = 'false'
process.env.SMTP_HOST = ''
process.env.SMTP_USER = ''
process.env.SMTP_PASSWORD = ''
process.env.EMAIL_FROM = ''
process.env.GOOGLE_CLIENT_ID = 'client-id'
process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:5001/api/auth/google/callback'

const origin = 'http://localhost:5173'
let mongo: MongoMemoryServer
let app: (typeof import('../src/app.js'))['app']
let User: (typeof import('../src/models/User.js'))['User']
let Session: (typeof import('../src/models/Session.js'))['Session']
let disconnect: () => Promise<void>

const cookieFrom = (response: request.Response, name: string) => {
  const cookies = response.headers['set-cookie'] as unknown as string[] | undefined
  return cookies?.find((cookie) => cookie.startsWith(`${name}=`) && !cookie.startsWith(`${name}=;`))?.split(';')[0]
}

async function signUp(email = 'password@example.com') {
  const response = await request(app).post('/api/auth/signup').send({ name: 'Learner <b>', email, password: 'correct horse battery', confirmPassword: 'correct horse battery' }).expect(201)
  return { accessToken: response.body.data.accessToken as string, refresh: cookieFrom(response, 'deepnova_refresh')!, user: response.body.data.user }
}

async function googleCallback(code = 'good') {
  const start = await request(app).get('/api/auth/google').query({ returnTo: '/lesson/transformers' }).expect(302)
  const stateCookie = cookieFrom(start, 'deepnova_google_state')!
  const state = new URL(start.headers.location).searchParams.get('state')!
  return request(app).get('/api/auth/google/callback').query({ state, code }).set('Cookie', stateCookie).expect(302)
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  const database = await import('../src/database.js')
  await database.connectDatabase(mongo.getUri('deepnova-test'))
  disconnect = database.disconnectDatabase
  app = (await import('../src/app.js')).app
  User = (await import('../src/models/User.js')).User
  Session = (await import('../src/models/Session.js')).Session
  await Promise.all([User.init(), Session.init()])
}, 120_000)

afterAll(async () => {
  await disconnect()
  await mongo.stop()
})

beforeEach(async () => {
  profile.sub = 'google-sub-1'
  profile.email = 'learner@example.com'
  profile.email_verified = true
  await Promise.all([User.deleteMany({}), Session.deleteMany({})])
})

describe('password accounts', () => {
  it('signs up, signs in, and reports health as connected', async () => {
    const { accessToken, user } = await signUp()
    expect(user.hasPassword).toBe(true)
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200)
    expect(me.body.data.user.email).toBe('password@example.com')
    expect(me.body.data.user.hasPassword).toBe(true)
    await request(app).post('/api/auth/login').send({ email: 'password@example.com', password: 'correct horse battery' }).expect(200)
    await request(app).get('/api/health').expect(200)
  })

  it('explains a duplicate signup', async () => {
    await signUp()
    const response = await request(app).post('/api/auth/signup').send({ name: 'Again', email: 'password@example.com', password: 'another long password', confirmPassword: 'another long password' }).expect(409)
    expect(response.body.error).toMatch(/already exists/)
  })
})

describe('refresh token rotation', () => {
  it('survives two tabs refreshing with the same cookie', async () => {
    const { refresh } = await signUp()
    const [first, second] = await Promise.all([
      request(app).post('/api/auth/refresh').set('Origin', origin).set('Cookie', refresh),
      request(app).post('/api/auth/refresh').set('Origin', origin).set('Cookie', refresh),
    ])
    expect([first.status, second.status]).toEqual([200, 200])
    const session = await Session.findOne({})
    expect(session?.revokedAt).toBeNull()
  })

  it('rotates to a different token each time', async () => {
    const { refresh } = await signUp()
    const response = await request(app).post('/api/auth/refresh').set('Origin', origin).set('Cookie', refresh).expect(200)
    expect(cookieFrom(response, 'deepnova_refresh')).not.toBe(refresh)
  })

  it('revokes the session when an old token is replayed after the grace window', async () => {
    const { refresh } = await signUp()
    await request(app).post('/api/auth/refresh').set('Origin', origin).set('Cookie', refresh).expect(200)
    await Session.updateOne({}, { $set: { rotatedAt: new Date(Date.now() - 60_000) } })
    await request(app).post('/api/auth/refresh').set('Origin', origin).set('Cookie', refresh).expect(401)
    const session = await Session.findOne({})
    expect(session?.revokedAt).not.toBeNull()
  })
})

describe('Google sign-in', () => {
  it('creates an account, starts a session, and returns to the requested page', async () => {
    const response = await googleCallback()
    expect(response.headers.location).toBe('http://localhost:5173/lesson/transformers')
    const refresh = cookieFrom(response, 'deepnova_refresh')!
    const refreshed = await request(app).post('/api/auth/refresh').set('Origin', origin).set('Cookie', refresh).expect(200)
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${refreshed.body.data.accessToken}`).expect(200)
    expect(me.body.data.user).toMatchObject({ email: 'learner@example.com', name: 'Google Learner', emailVerified: true, hasPassword: false })
  })

  it('reuses the same account on the next sign-in', async () => {
    await googleCallback()
    await googleCallback()
    expect(await User.countDocuments({})).toBe(1)
  })

  it('links to an existing verified password account and keeps its password', async () => {
    const { user } = await signUp('learner@example.com')
    const response = await googleCallback()
    expect(response.headers.location).toBe('http://localhost:5173/lesson/transformers')
    const linked = await User.findById(user.id).select('+passwordHash +googleId')
    expect(linked?.googleId).toBe('google-sub-1')
    expect(linked?.passwordHash).toBeTruthy()
    await request(app).post('/api/auth/login').send({ email: 'learner@example.com', password: 'correct horse battery' }).expect(200)
  })

  it('strips the password from an unverified account, so a squatter loses access', async () => {
    const { user } = await signUp('learner@example.com')
    await User.updateOne({ _id: user.id }, { $set: { emailVerified: false } })
    await googleCallback()
    const linked = await User.findById(user.id).select('+passwordHash')
    expect(linked?.passwordHash).toBeUndefined()
    expect(linked?.emailVerified).toBe(true)
    await request(app).post('/api/auth/login').send({ email: 'learner@example.com', password: 'correct horse battery' }).expect(401)
    expect(await Session.countDocuments({ userId: user.id, revokedAt: null })).toBe(1)
  })

  it('refuses an email already linked to a different Google account', async () => {
    await googleCallback()
    profile.sub = 'google-sub-2'
    const response = await googleCallback()
    expect(response.headers.location).toBe('http://localhost:5173/login?error=google_conflict')
    expect(await User.countDocuments({})).toBe(1)
  })

  it.each([
    ['a forged state', async () => request(app).get('/api/auth/google/callback').query({ state: 'forged', code: 'good' }).set('Cookie', 'deepnova_google_state=real.Lw').expect(302), 'google_state'],
    ['a failed token exchange', async () => googleCallback('bad'), 'google_failed'],
  ])('redirects with a readable error for %s', async (_name, run, code) => {
    const response = await run()
    expect(response.headers.location).toBe(`http://localhost:5173/login?error=${code}`)
    expect(cookieFrom(response, 'deepnova_refresh')).toBeUndefined()
  })

  it('rejects an unverified Google email', async () => {
    profile.email_verified = false
    const response = await googleCallback()
    expect(response.headers.location).toBe('http://localhost:5173/login?error=google_unverified')
  })

  it('never redirects to another site', async () => {
    const start = await request(app).get('/api/auth/google').query({ returnTo: '//evil.example' }).expect(302)
    const stored = decodeURIComponent(cookieFrom(start, 'deepnova_google_state')!.split('=')[1])
    expect(Buffer.from(stored.split('.')[1], 'base64url').toString()).toBe('/')
  })
})

describe('learning data', () => {
  it('imports guest progress without overwriting account data', async () => {
    const { accessToken } = await signUp()
    const auth = { Authorization: `Bearer ${accessToken}` }
    await request(app).put('/api/notes/linear-regression').set(auth).send({ content: 'account note' }).expect(200)
    await request(app).post('/api/bookmarks').set(auth).send({ lessonSlug: 'perceptrons' }).expect(201)
    await request(app).put('/api/progress/transformers').set(auth).send({ isCompleted: true }).expect(200)

    const payload = { completed: ['transformers', 'neural-networks', 'not-a-real-lesson'], bookmarks: ['perceptrons', 'optimizers'], notes: { 'linear-regression': 'guest note', 'gradient-descent': 'guest gradient note' }, activity: ['2026-11-01', '2026-11-02'] }
    await request(app).post('/api/progress/import').set(auth).send(payload).expect(200)
    await request(app).post('/api/progress/import').set(auth).send(payload).expect(200)

    const progress = await request(app).get('/api/progress').set(auth).expect(200)
    expect(progress.body.data.progress.filter((item: { isCompleted: boolean }) => item.isCompleted).map((item: { lessonSlug: string }) => item.lessonSlug).sort()).toEqual(['neural-networks', 'transformers'])
    expect(progress.body.data.activity.sort()).toEqual(['2026-11-01', '2026-11-02'])
    const bookmarks = await request(app).get('/api/bookmarks').set(auth).expect(200)
    expect(bookmarks.body.data.bookmarks).toHaveLength(2)
    const kept = await request(app).get('/api/notes/linear-regression').set(auth).expect(200)
    expect(kept.body.data.note.content).toBe('account note')
    const added = await request(app).get('/api/notes/gradient-descent').set(auth).expect(200)
    expect(added.body.data.note.content).toBe('guest gradient note')
  })

  it('returns the dashboard shape the client reads', async () => {
    const { accessToken } = await signUp()
    const auth = { Authorization: `Bearer ${accessToken}` }
    await request(app).post('/api/progress/neural-networks/accessed').set(auth).send({ day: '2026-11-04' }).expect(200)
    const dashboard = await request(app).get('/api/progress/dashboard').set(auth).expect(200)
    expect(dashboard.body.data.continueLearning.slug).toBe('neural-networks')
    const progress = await request(app).get('/api/progress').set(auth).expect(200)
    expect(progress.body.data.activity).toEqual(['2026-11-04'])
  })

  it('scores a correct quiz answer as one out of one, and finds the best attempt', async () => {
    const { accessToken } = await signUp()
    const auth = { Authorization: `Bearer ${accessToken}` }
    const { findPublishedLesson } = await import('../src/catalog.js')
    const answer = findPublishedLesson('transformers')!.quiz.answer
    const attempt = await request(app).post('/api/quizzes/attempts').set(auth).send({ lessonSlug: 'transformers', selectedIndex: answer }).expect(201)
    expect(attempt.body.data.attempt).toMatchObject({ score: 1, totalQuestions: 1 })
    const list = await request(app).get('/api/quizzes/attempts').set(auth).expect(200)
    expect(list.body.data.best).toHaveLength(1)
  })

  it('keeps users’ data apart', async () => {
    const first = await signUp('first@example.com')
    const second = await signUp('second@example.com')
    await request(app).put('/api/notes/perceptrons').set('Authorization', `Bearer ${first.accessToken}`).send({ content: 'private' }).expect(200)
    const other = await request(app).get('/api/notes/perceptrons').set('Authorization', `Bearer ${second.accessToken}`).expect(200)
    expect(other.body.data.note).toBeNull()
  })

  it('rejects tokens signed with another secret', async () => {
    const forged = jwt.sign({ type: 'access', sid: '507f1f77bcf86cd799439011' }, 'some-other-secret', { subject: '507f1f77bcf86cd799439011' })
    await request(app).get('/api/progress').set('Authorization', `Bearer ${forged}`).expect(401)
  })
})
