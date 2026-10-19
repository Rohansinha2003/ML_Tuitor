import { Schema, model, type InferSchemaType } from 'mongoose'

const lessonNoteSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lessonSlug: { type: String, required: true, trim: true, maxlength: 120 },
  content: { type: String, required: true, maxlength: 20_000 },
}, { timestamps: true })

lessonNoteSchema.index({ userId: 1, lessonSlug: 1 }, { unique: true })
export type LessonNoteRecord = InferSchemaType<typeof lessonNoteSchema>
export const LessonNote = model('LessonNote', lessonNoteSchema)
