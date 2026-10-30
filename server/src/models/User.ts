import { Schema, model, type InferSchemaType } from 'mongoose'

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  passwordHash: { type: String, required: false, select: false, default: undefined },
  googleId: { type: String, unique: true, sparse: true, select: false, default: undefined },
  authProvider: { type: String, enum: ['password', 'google'], default: 'password' },
  avatarUrl: { type: String, default: null, maxlength: 2048 },
  emailVerified: { type: Boolean, default: false },
  verificationTokenHash: { type: String, select: false, default: undefined },
  verificationExpiresAt: { type: Date, select: false, default: undefined },
  resetTokenHash: { type: String, select: false, default: undefined },
  resetExpiresAt: { type: Date, select: false, default: undefined },
  passwordChangedAt: { type: Date, default: null },
}, { timestamps: true })

userSchema.index({ email: 1 }, { unique: true })
export type UserRecord = InferSchemaType<typeof userSchema>
export const User = model('User', userSchema)
