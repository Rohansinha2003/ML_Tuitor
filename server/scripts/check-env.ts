// Checks every external service in server/.env against the real provider and prints what to fix.
// Read-only: it sends no email, creates no data, and never prints secret values.
import mongoose from 'mongoose'
import nodemailer from 'nodemailer'
import { env } from '../src/config/env.js'

let failures = 0
const pass = (label: string, detail = '') => console.log(`  ok    ${label}${detail ? ` — ${detail}` : ''}`)
const skip = (label: string, detail: string) => console.log(`  skip  ${label} — ${detail}`)
const fail = (label: string, fix: string) => {
  failures += 1
  console.log(`  FAIL  ${label}\n        → ${fix}`)
}
const redact = (text: string) => text.replace(/:\/\/[^@\s]*@/g, '://***@')

async function checkDatabase() {
  console.log('MongoDB')
  if (!env.MONGODB_URI) return skip('MONGODB_URI', 'empty, so local dev uses an in-memory database that is erased on restart')
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 })
    await mongoose.connection.db!.admin().ping()
    pass('connection', `database "${mongoose.connection.db!.databaseName}"`)
  } catch (error) {
    const message = redact(error instanceof Error ? error.message : String(error))
    if (/auth/i.test(message)) fail('authentication', 'Check the username and password in MONGODB_URI (URL-encode special characters).')
    else fail('connection', `Atlas → Network Access must allow this machine; Vercel needs 0.0.0.0/0. (${message.slice(0, 140)})`)
  } finally {
    await mongoose.disconnect()
  }
}

async function checkGoogle() {
  console.log('Google sign-in')
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return skip('credentials', 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are empty')
  const token = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: 'check-env-probe', client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: env.GOOGLE_CALLBACK_URL, grant_type: 'authorization_code' }),
  })
  const { error } = await token.json() as { error?: string }
  if (error === 'invalid_grant') pass('client ID and secret accepted')
  else fail('client ID and secret', `Google answered "${error}". Copy both values again from the OAuth client in Google Cloud Console.`)

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: env.GOOGLE_CALLBACK_URL, response_type: 'code', scope: 'openid email profile', state: 'check-env' }).toString()
  const auth = await fetch(authUrl, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 Chrome/130 Safari/537.36' } })
  const target = new URL(auth.headers.get('location') ?? 'https://accounts.google.com/', 'https://accounts.google.com')
  const reason = Buffer.from(target.searchParams.get('authError') ?? '', 'base64url').toString('latin1')
  if (reason.includes('redirect_uri_mismatch')) {
    fail(`redirect URI ${env.GOOGLE_CALLBACK_URL}`, 'Not registered. Add it exactly under Google Cloud Console → APIs & Services → Credentials → your OAuth client → Authorized redirect URIs.')
  } else if (target.pathname.includes('/error')) {
    fail('authorization request', `Google rejected it: ${reason.replace(/[^\x20-\x7e]+/g, ' ').trim().slice(0, 160)}`)
  } else {
    pass('redirect URI registered', env.GOOGLE_CALLBACK_URL)
  }
}

async function checkEmail() {
  console.log('Email (SMTP)')
  if (!env.emailConfigured) return skip('SMTP', 'not fully configured; signups skip email verification and password reset is off')
  try {
    await nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, requireTLS: env.SMTP_PORT !== 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }, connectionTimeout: 8_000 }).verify()
    pass('login accepted')
  } catch (error) {
    fail('login', `Use a Google App Password, not your account password. (${(error as { code?: string }).code ?? 'unknown error'})`)
  }
}

function checkApp() {
  console.log('App')
  pass('CLIENT_ORIGIN', env.CLIENT_ORIGIN)
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) fail('JWT secrets', 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ.')
  else pass('JWT secrets are distinct')
}

checkApp()
await checkDatabase()
await checkGoogle()
await checkEmail()
console.log(failures ? `\n${failures} problem(s) to fix.` : '\nEverything checks out.')
process.exit(failures ? 1 : 0)
