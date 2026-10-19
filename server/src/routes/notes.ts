import { Router } from 'express'
import { LessonNote } from '../models/LessonNote.js'
import { authenticate } from '../middleware/authenticate.js'
import { HttpError } from '../middleware/errorHandler.js'
import { findPublishedLesson } from '../catalog.js'
import { noteSchema, parseSlug } from '../validators/schemas.js'
import { validateBody } from '../middleware/validate.js'

export const noteRouter = Router()
noteRouter.use(authenticate)

noteRouter.get('/:lessonSlug', async (request, response) => {
  const slug = parseSlug(request.params.lessonSlug)
  if (!findPublishedLesson(slug)) throw new HttpError(404, 'Published lesson not found')
  const note = await LessonNote.findOne({ userId: request.auth!.userId, lessonSlug: slug }).lean()
  response.json({ data: { note } })
})

noteRouter.put('/:lessonSlug', validateBody(noteSchema), async (request, response) => {
  const slug = parseSlug(request.params.lessonSlug)
  if (!findPublishedLesson(slug)) throw new HttpError(404, 'Published lesson not found')
  const { content } = request.body as { content: string }
  if (!content.trim()) {
    await LessonNote.deleteOne({ userId: request.auth!.userId, lessonSlug: slug })
    response.json({ data: { note: null, deleted: true } })
    return
  }
  const note = await LessonNote.findOneAndUpdate(
    { userId: request.auth!.userId, lessonSlug: slug },
    { $set: { content }, $setOnInsert: { userId: request.auth!.userId, lessonSlug: slug } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean()
  response.json({ data: { note } })
})

noteRouter.delete('/:lessonSlug', async (request, response) => {
  const slug = parseSlug(request.params.lessonSlug)
  if (!findPublishedLesson(slug)) throw new HttpError(404, 'Published lesson not found')
  const result = await LessonNote.deleteOne({ userId: request.auth!.userId, lessonSlug: slug })
  response.json({ data: { removed: result.deletedCount === 1 } })
})
