import { Router } from 'express'
import { Bookmark } from '../models/Bookmark.js'
import { LessonProgress } from '../models/LessonProgress.js'
import { QuizAttempt } from '../models/QuizAttempt.js'
import { authenticate } from '../middleware/authenticate.js'
import { HttpError } from '../middleware/errorHandler.js'
import { findPublishedLesson, getPublishedModules, publishedLessonSlugs } from '../catalog.js'
import { parseSlug, progressSchema } from '../validators/schemas.js'
import { validateBody } from '../middleware/validate.js'

export const progressRouter = Router()
progressRouter.use(authenticate)

function requireLesson(rawSlug: unknown) {
  const slug = parseSlug(rawSlug)
  const lesson = findPublishedLesson(slug)
  if (!lesson) throw new HttpError(404, 'Published lesson not found')
  return lesson
}

progressRouter.get('/', async (request, response) => {
  const progress = await LessonProgress.find({ userId: request.auth!.userId, lessonSlug: { $in: [...publishedLessonSlugs] } }).sort({ lastAccessedAt: -1 }).lean()
  response.json({ data: { progress } })
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
    learningStreak: null,
  } })
})

progressRouter.get('/:lessonSlug', async (request, response) => {
  const lesson = requireLesson(request.params.lessonSlug)
  const progress = await LessonProgress.findOne({ userId: request.auth!.userId, lessonSlug: lesson.slug }).lean()
  response.json({ data: { progress } })
})

progressRouter.post('/:lessonSlug/accessed', async (request, response) => {
  const lesson = requireLesson(request.params.lessonSlug)
  const progress = await LessonProgress.findOneAndUpdate(
    { userId: request.auth!.userId, lessonSlug: lesson.slug },
    { $set: { lastAccessedAt: new Date() }, $setOnInsert: { isCompleted: false, completedAt: null } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean()
  response.json({ data: { progress } })
})

progressRouter.put('/:lessonSlug', validateBody(progressSchema), async (request, response) => {
  const lesson = requireLesson(request.params.lessonSlug)
  const body = request.body as { isCompleted?: boolean; lastSection?: string | null }
  const existing = await LessonProgress.findOne({ userId: request.auth!.userId, lessonSlug: lesson.slug }).lean()
  const update: Record<string, unknown> = { lastAccessedAt: new Date() }
  if (body.lastSection !== undefined) update.lastSection = body.lastSection
  if (body.isCompleted !== undefined) {
    update.isCompleted = body.isCompleted
    update.completedAt = body.isCompleted ? (existing?.isCompleted && existing.completedAt ? existing.completedAt : new Date()) : null
  }
  const progress = await LessonProgress.findOneAndUpdate(
    { userId: request.auth!.userId, lessonSlug: lesson.slug },
    { $set: update, $setOnInsert: { isCompleted: false, completedAt: null } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean()
  response.json({ data: { progress } })
})
