import { Schema, model, type InferSchemaType } from 'mongoose'

const sessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  refreshTokenHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  rotatedAt: { type: Date, default: null },
}, { timestamps: true })

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
export type SessionRecord = InferSchemaType<typeof sessionSchema>
export const Session = model('Session', sessionSchema)
