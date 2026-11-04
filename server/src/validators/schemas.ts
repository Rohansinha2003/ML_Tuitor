import { z } from 'zod'

const password = z.string().min(12).max(128).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes')
const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase())
const lessonSlug = z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/)

const activityDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email,
  password,
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) })
export const forgotPasswordSchema = z.object({ email })
export const resendVerificationSchema = z.object({ email })
export const resetPasswordSchema = z.object({ token: z.string().min(32).max(256), password, confirmPassword: z.string() }).refine((value) => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
export const verifyEmailSchema = z.object({ token: z.string().min(32).max(256) })
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), password, confirmPassword: z.string() }).refine((value) => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })

export const progressSchema = z.object({
  isCompleted: z.boolean().optional(),
  lastSection: z.string().trim().max(160).nullable().optional(),
  day: activityDay.optional(),
})
export const noteSchema = z.object({ content: z.string().max(20_000) })
export const quizAttemptSchema = z.object({ lessonSlug, selectedIndex: z.number().int().nonnegative() })
export const accessedSchema = z.object({ day: activityDay.optional() })
export const importProgressSchema = z.object({
  completed: z.array(lessonSlug).max(500).default([]),
  bookmarks: z.array(lessonSlug).max(500).default([]),
  notes: z.record(lessonSlug, z.string().max(20_000)).default({}),
  activity: z.array(activityDay).max(3660).default([]),
  lastLesson: lessonSlug.optional(),
})
export const listQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) })

export function parseSlug(value: unknown) {
  return lessonSlug.parse(value)
}
