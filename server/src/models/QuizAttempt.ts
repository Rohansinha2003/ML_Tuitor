import { Schema, model, type InferSchemaType } from 'mongoose'

const quizAttemptSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lessonSlug: { type: String, required: true, trim: true, maxlength: 120 },
  score: { type: Number, required: true, min: 0, validate: Number.isInteger },
  totalQuestions: { type: Number, required: true, min: 1, validate: Number.isInteger },
  attemptedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true })

quizAttemptSchema.pre('validate', function () {
  if (this.score > this.totalQuestions) this.invalidate('score', 'Score cannot exceed total questions')
})
quizAttemptSchema.index({ userId: 1, lessonSlug: 1, attemptedAt: -1 })
export type QuizAttemptRecord = InferSchemaType<typeof quizAttemptSchema>
export const QuizAttempt = model('QuizAttempt', quizAttemptSchema)
