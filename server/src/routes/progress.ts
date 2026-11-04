import { Router } from 'express'
import { Types } from 'mongoose'
import { LessonNote } from '../models/LessonNote.js'
import { User } from '../models/User.js'
import { Bookmark } from '../models/Bookmark.js'
import { LessonProgress } from '../models/LessonProgress.js'
import { QuizAttempt } from '../models/QuizAttempt.js'
import { authenticate } from '../middleware/authenticate.js'
import { HttpError } from '../middleware/errorHandler.js'
import { findPublishedLesson, getPublishedModules, publishedLessonSlugs } from '../catalog.js'
import { accessedSchema, importProgressSchema, parseSlug, progressSchema } from '../validators/schemas.js'
import { validateBody } from '../middleware/validate.js'

export const progressRouter = Router()
progressRouter.use(authenticate)

// The filter skips already-completed rows, so an upsert can collide with them on the unique index.
function ignoreDuplicates(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) return
  throw error
}

function requireLesson(rawSlug: unknown) {
  const slug = parseSlug(rawSlug)
  const lesson = findPublishedLesson(slug)
  if (!lesson) throw new HttpError(404, 'Published lesson not found')
  return lesson
}

async function recordActivityDay(userId: string, day: string | undefined) {
  if (day) await User.updateOne({ _id: userId }, { $addToSet: { activityDays: day } })
}

progressRouter.get('/', async (request, response) => {
  const userId = request.auth!.userId
  const [progress, user] = await Promise.all([
    LessonProgress.find({ userId, lessonSlug: { $in: [...publishedLessonSlugs] } }).sort({ lastAccessedAt: -1 }).lean(),
    User.findById(userId).select('+activityDays').lean(),
  ])
  response.json({ data: { progress, activity: user?.activityDays ?? [] } })
})

// Moves progress a learner made as a guest into their account. Existing account data always wins.
progressRouter.post('/import', validateBody(importProgressSchema), async (request, response) => {
  const userId = new Types.ObjectId(request.auth!.userId)
  const body = request.body as { completed: string[]; bookmarks: string[]; notes: Record<string, string>; activity: string[]; lastLesson?: string }
  const published = (slug: string) => publishedLessonSlugs.has(slug)
  const now = new Date()
  const completed = [...new Set(body.completed)].filter(published)
  const bookmarks = [...new Set(body.bookmarks)].filter(published)
  const notes = Object.entries(body.notes).filter(([slug, content]) => published(slug) && content.trim())
  await Promise.all([
    completed.length && LessonProgress.bulkWrite(completed.map((lessonSlug) => ({ updateOne: {
      filter: { userId, lessonSlug, isCompleted: { $ne: true } },
      update: { $set: { isCompleted: true, completedAt: now }, $setOnInsert: { lastAccessedAt: now } },
      upsert: true,
    } })), { ordered: false }).catch(ignoreDuplicates),
    bookmarks.length && Bookmark.bulkWrite(bookmarks.map((lessonSlug) => ({ updateOne: {
      filter: { userId, lessonSlug },
      update: { $setOnInsert: { userId, lessonSlug } },
      upsert: true,
    } })), { ordered: false }),
    notes.length && LessonNote.bulkWrite(notes.map(([lessonSlug, content]) => ({ updateOne: {
      filter: { userId, lessonSlug },
      update: { $setOnInsert: { content } },
      upsert: true,
    } })), { ordered: false }),
    body.activity.length && User.updateOne({ _id: userId }, { $addToSet: { activityDays: { $each: body.activity } } }),
  ])
  response.json({ data: { imported: true } })
})

progressRouter.get('/dashboard', async (request, response) => {
  const userId = request.auth!.userId
  const [progress, bookmarks, attempts] = await Promise.all([
    LessonProgress.find({ userId, lessonSlug: { $in: [...publishedLessonSlugs] } }).sort({ lastAccessedAt: -1 }).lean(),
    Bookmark.find({ userId, lessonSlug: { $in: [...publishedLessonSlugs] } }).sort({ createdAt: -1 }).lean(),
    QuizAttempt.find({ userId, lessonSlug: { $in: [...publishedLessonSlugs] } }).sort({ attemptedAt: -1 }).limit(100).lean(),
  ])
  const completed = new Set(progress.filter((item) => item.isCompleted).map((item) => item.lessonSlug))
  const accessed = progress.filter((item) => item.lastAccessedAt).sort((first, second) => second.lastAccessedAt.getTime() - first.lastAccessedAt.getTime())
  const continueLesson = accessed.find((item) => !item.isCompleted) ?? accessed[0]
  const courseProgress = getPublishedModules().map((module) => {
    const completedCount = module.lessonSlugs.filter((slug) => completed.has(slug)).length
    const total = module.lessonSlugs.length
    return { moduleId: module.id, title: module.title, completed: completedCount, total, percentage: total ? Math.round(completedCount / total * 100) : 0 }
  })
  const latestByLesson = new Map<string, typeof attempts[number]>()
  const bestByLesson = new Map<string, typeof attempts[number]>()
  for (const attempt of attempts) {
    if (!latestByLesson.has(attempt.lessonSlug)) latestByLesson.set(attempt.lessonSlug, attempt)
    const currentBest = bestByLesson.get(attempt.lessonSlug)
    if (!currentBest || attempt.score / attempt.totalQuestions > currentBest.score / currentBest.totalQuestions) bestByLesson.set(attempt.lessonSlug, attempt)
  }
  const lessonInfo = (slug: string) => {
    const lesson = findPublishedLesson(slug)
    return lesson ? { slug, title: lesson.title, module: lesson.module } : null
  }
  response.json({ data: {
    totalPublishedLessons: publishedLessonSlugs.size,
    completedLessons: completed.size,
    overallProgress: publishedLessonSlugs.size ? Math.round(completed.size / publishedLessonSlugs.size * 100) : 0,
    courseProgress,
    continueLearning: continueLesson ? lessonInfo(continueLesson.lessonSlug) : lessonInfo([...publishedLessonSlugs][0]),
    recentlyAccessed: accessed.slice(0, 6).map((item) => ({ ...lessonInfo(item.lessonSlug), lastAccessedAt: item.lastAccessedAt, isCompleted: item.isCompleted })),
    bookmarks: bookmarks.map((item) => ({ ...lessonInfo(item.lessonSlug), createdAt: item.createdAt })),
    latestQuizAttempts: [...latestByLesson.values()].slice(0, 5),
    bestQuizAttempts: [...bestByLesson.values()].slice(0, 5),
      } })
})

progressRouter.get('/:lessonSlug', async (request, response) => {
  const lesson = requireLesson(request.params.lessonSlug)
  const progress = await LessonProgress.findOne({ userId: request.auth!.userId, lessonSlug: lesson.slug }).lean()
  response.json({ data: { progress } })
})

progressRouter.post('/:lessonSlug/accessed', validateBody(accessedSchema), async (request, response) => {
  const lesson = requireLesson(request.params.lessonSlug)
  await recordActivityDay(request.auth!.userId, (request.body as { day?: string }).day)
  const progress = await LessonProgress.findOneAndUpdate(
    { userId: request.auth!.userId, lessonSlug: lesson.slug },
    { $set: { lastAccessedAt: new Date() }, $setOnInsert: { isCompleted: false, completedAt: null } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean()
  response.json({ data: { progress } })
})

progressRouter.put('/:lessonSlug', validateBody(progressSchema), async (request, response) => {
  const lesson = requireLesson(request.params.lessonSlug)
  const body = request.body as { isCompleted?: boolean; lastSection?: string | null; day?: string }
  await recordActivityDay(request.auth!.userId, body.day)
  const existing = await LessonProgress.findOne({ userId: request.auth!.userId, lessonSlug: lesson.slug }).lean()
  const update: Record<string, unknown> = { lastAccessedAt: new Date() }
  if (body.lastSection !== undefined) update.lastSection = body.lastSection
  if (body.isCompleted !== undefined) {
    update.isCompleted = body.isCompleted
    update.completedAt = body.isCompleted ? (existing?.isCompleted && existing.completedAt ? existing.completedAt : new Date()) : null
  }
  // MongoDB rejects a path that appears in both $set and $setOnInsert.
  const insertDefaults = body.isCompleted === undefined ? { isCompleted: false, completedAt: null } : {}
  const progress = await LessonProgress.findOneAndUpdate(
    { userId: request.auth!.userId, lessonSlug: lesson.slug },
    { $set: update, $setOnInsert: insertDefaults },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean()
  response.json({ data: { progress } })
})
