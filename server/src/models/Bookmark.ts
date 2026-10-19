import { Schema, model, type InferSchemaType } from 'mongoose'

const bookmarkSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lessonSlug: { type: String, required: true, trim: true, maxlength: 120 },
}, { timestamps: { createdAt: true, updatedAt: false } })

bookmarkSchema.index({ userId: 1, lessonSlug: 1 }, { unique: true })
export type BookmarkRecord = InferSchemaType<typeof bookmarkSchema>
export const Bookmark = model('Bookmark', bookmarkSchema)
