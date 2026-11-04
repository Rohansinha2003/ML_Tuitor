import dotenv from 'dotenv'
import { z } from 'zod'

// Works from the repo root or from server/. Hosted platforms inject real variables and ship neither file.
dotenv.config({ path: ['.env', 'server/.env'] })

const defaultAccessSecret = 'deepnova_default_jwt_access_secret_32_bytes_long_min'
const defaultRefreshSecret = 'deepnova_default_jwt_refresh_secret_32_bytes_long_min'
// Production traffic must return to the stable project domain, not a per-deployment URL.
const vercelHost =
  process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : process.env.VERCEL_URL
const defaultOrigin =
  (vercelHost ? `https://${vercelHost}` : undefined) ||
  (process.env.NODE_ENV === 'production' ? 'https://ml-tuitor.vercel.app' : 'http://localhost:5173')

const defaultCookieSecure = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === 'true'
  : process.env.NODE_ENV === 'production'

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().min(1).optional().or(z.literal('')),
  CLIENT_ORIGIN: z.preprocess((value) => value || undefined, z.string().url().default(defaultOrigin)).transform((value) => value.replace(/\/+$/, '')),
  JWT_ACCESS_SECRET: z.string().min(32).default(() => {
    return process.env.JWT_ACCESS_SECRET || defaultAccessSecret
  }),
  JWT_REFRESH_SECRET: z.string().min(32).default(() => {
    return process.env.JWT_REFRESH_SECRET || defaultRefreshSecret
  }),
  COOKIE_SECURE: z.enum(['true', 'false']).default(defaultCookieSecure ? 'true' : 'false').transform((value) => value === 'true'),
  EMAIL_FROM: z.string().email().optional().or(z.literal('')),
  SMTP_HOST: z.string().optional().or(z.literal('')),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().optional().or(z.literal('')),
  SMTP_PASSWORD: z.string().optional().or(z.literal('')),
  GOOGLE_CLIENT_ID: z.string().optional().or(z.literal('')),
  GOOGLE_CLIENT_SECRET: z.string().optional().or(z.literal('')),
  GOOGLE_CALLBACK_URL: z.string().url().optional().or(z.literal('')),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n')
  throw new Error(`Invalid backend environment configuration:\n${issues}`)
}

if (
  parsed.data.NODE_ENV === 'production' &&
  (parsed.data.JWT_ACCESS_SECRET === defaultAccessSecret || parsed.data.JWT_REFRESH_SECRET === defaultRefreshSecret)
) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set to unique values in production')
}

if (parsed.data.NODE_ENV === 'production' && !parsed.data.COOKIE_SECURE) {
  console.warn('⚠️ COOKIE_SECURE is false in production environment')
}

const googleCallbackUrl = parsed.data.GOOGLE_CALLBACK_URL || `${parsed.data.CLIENT_ORIGIN}/api/auth/google/callback`

if (parsed.data.NODE_ENV === 'production' && parsed.data.GOOGLE_CLIENT_ID && /localhost|127\.0\.0\.1/.test(googleCallbackUrl)) {
  console.warn('GOOGLE_CALLBACK_URL points at localhost in production; Google sign-in will fail for deployed users')
}

export const env = {
  ...parsed.data,
  GOOGLE_CALLBACK_URL: googleCallbackUrl,
  emailConfigured: Boolean(parsed.data.SMTP_HOST && parsed.data.SMTP_USER && parsed.data.SMTP_PASSWORD && parsed.data.EMAIL_FROM),
  googleConfigured: Boolean(parsed.data.GOOGLE_CLIENT_ID && parsed.data.GOOGLE_CLIENT_SECRET),
}
