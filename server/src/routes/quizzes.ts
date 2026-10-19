import { Router } from 'express'
import { QuizAttempt } from '../models/QuizAttempt.js'
import { LessonProgress } from '../models/LessonProgress.js'
import { authenticate } from '../middleware/authenticate.js'
import { HttpError } from '../middleware/errorHandler.js'
import { findPublishedLesson, publishedLessonSlugs } from '../catalog.js'
import { listQuerySchema, parseSlug, quizAttemptSchema } from '../validators/schemas.js'
import { validateBody } from '../middleware/validate.js'

export const quizRouter = Router()
quizRouter.use(authenticate)

quizRouter.post('/', validateBody(quizAttemptSchema), async (request, response) => {
  const { lessonSlug, selectedIndex } = request.body as { lessonSlug: string; selectedIndex: number }
  const lesson = findPublishedLesson(lessonSlug)
  if (!lesson) throw new HttpError(404, 'Published lesson not found')
  if (selectedIndex >= lesson.quiz.options.length) throw new HttpError(400, 'Selected answer is outside the quiz options')
  const totalQuestions = lesson.quiz.options.length
  const score = selectedIndex === lesson.quiz.answer ? 1 : 0
  const [attempt] = await Promise.all([
    QuizAttempt.create({ userId: request.auth!.userId, lessonSlug, score, totalQuestions, attemptedAt: new Date() }),
    LessonProgress.findOneAndUpdate(
      { userId: request.auth!.userId, lessonSlug },
      { $set: { quizScore: score / totalQuestions, lastAccessedAt: new Date() }, $setOnInsert: { isCompleted: false, completedAt: null } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ),
  ])
  response.status(201).json({ data: { attempt } })
})

quizRouter.get('/', async (request, response) => {
  const { page, limit } = listQuerySchema.parse(request.query)
  const userId = request.auth!.userId
  const [attempts, total, best] = await Promise.all([
    QuizAttempt.find({ userId, lessonSlug: { $in: [...publishedLessonSlugs] } }).sort({ attemptedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    QuizAttempt.countDocuments({ userId, lessonSlug: { $in: [...publishedLessonSlugs] } }),
    QuizAttempt.aggregate([
      { $match: { userId: request.auth!.userId, lessonSlug: { $in: [...publishedLessonSlugs] } } },
      { $addFields: { ratio: { $divide: ['$score', '$totalQuestions'] } } },
      { $sort: { ratio: -1, attemptedAt: -1 } },
      { $group: { _id: '$lessonSlug', attempt: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$attempt' } },
    ]),
  ])
  response.json({ data: { attempts, best, page, limit, total, pages: Math.ceil(total / limit) } })
})

quizRouter.get('/:lessonSlug', async (request, response) => {
  const slug = parseSlug(request.params.lessonSlug)
  if (!findPublishedLesson(slug)) throw new HttpError(404, 'Published lesson not found')
  const userId = request.auth!.userId
  const [latest, best, totalAttempts] = await Promise.all([
    QuizAttempt.findOne({ userId, lessonSlug: slug }).sort({ attemptedAt: -1 }).lean(),
    QuizAttempt.findOne({ userId, lessonSlug: slug }).sort({ score: -1, attemptedAt: -1 }).lean(),
    QuizAttempt.countDocuments({ userId, lessonSlug: slug }),
  ])
  response.json({ data: { latest, best, totalAttempts } })
})
