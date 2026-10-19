import { Router } from 'express'
import { Bookmark } from '../models/Bookmark.js'
import { authenticate } from '../middleware/authenticate.js'
import { HttpError } from '../middleware/errorHandler.js'
import { findPublishedLesson, publishedLessonSlugs } from '../catalog.js'
import { parseSlug } from '../validators/schemas.js'

export const bookmarkRouter = Router()
bookmarkRouter.use(authenticate)

bookmarkRouter.get('/', async (request, response) => {
  const bookmarks = await Bookmark.find({ userId: request.auth!.userId, lessonSlug: { $in: [...publishedLessonSlugs] } }).sort({ createdAt: -1 }).lean()
  response.json({ data: { bookmarks } })
})

bookmarkRouter.post('/', async (request, response) => {
  const slug = parseSlug(request.body?.lessonSlug)
  if (!findPublishedLesson(slug)) throw new HttpError(404, 'Published lesson not found')
  try {
    const bookmark = await Bookmark.findOneAndUpdate(
      { userId: request.auth!.userId, lessonSlug: slug },
      { $setOnInsert: { userId: request.auth!.userId, lessonSlug: slug } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean()
    response.status(201).json({ data: { bookmark } })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      const bookmark = await Bookmark.findOne({ userId: request.auth!.userId, lessonSlug: slug }).lean()
      response.status(200).json({ data: { bookmark } })
      return
    }
    throw error
  }
})

bookmarkRouter.delete('/:lessonSlug', async (request, response) => {
  const slug = parseSlug(request.params.lessonSlug)
  if (!findPublishedLesson(slug)) throw new HttpError(404, 'Published lesson not found')
  const result = await Bookmark.deleteOne({ userId: request.auth!.userId, lessonSlug: slug })
  response.json({ data: { removed: result.deletedCount === 1 } })
})
