import type { Request, RequestHandler } from 'express'
import { env } from '../config/env.js'
import { HttpError } from './errorHandler.js'

// Only this project's own hosts. A blanket *.vercel.app rule would also trust other people's deployments.
const trustedOrigins = new Set(
  [
    env.CLIENT_ORIGIN,
    'https://ml-tuitor.vercel.app',
    ...[process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
      .filter(Boolean)
      .map((host) => `https://${host}`),
  ],
)

export function isTrustedOrigin(origin: string) {
  if (trustedOrigins.has(origin)) return true
  return env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
}

function isSameOrigin(request: Request, origin: string) {
  try {
    return new URL(origin).host === request.get('host')
  } catch {
    return false
  }
}

export const requireClientOrigin: RequestHandler = (request, _response, next) => {
  const origin = request.get('origin')
  if (!origin || !(isTrustedOrigin(origin) || isSameOrigin(request, origin))) {
    next(new HttpError(403, 'Request origin is not allowed'))
    return
  }
  next()
}
