import mongoose from 'mongoose'

export async function connectDatabase(uri: string) {
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 })
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
}
