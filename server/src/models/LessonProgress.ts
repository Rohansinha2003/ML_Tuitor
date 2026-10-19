import { Schema, model, type InferSchemaType } from 'mongoose'

const lessonProgressSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lessonSlug: { type: String, required: true, trim: true, maxlength: 120 },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
  lastAccessedAt: { type: Date, default: Date.now },
  lastSection: { type: String, default: null, maxlength: 160 },
}, { timestamps: true })

lessonProgressSchema.index({ userId: 1, lessonSlug: 1 }, { unique: true })
lessonProgressSchema.index({ userId: 1, lastAccessedAt: -1 })
export type LessonProgressRecord = InferSchemaType<typeof lessonProgressSchema>
export const LessonProgress = model('LessonProgress', lessonProgressSchema)
