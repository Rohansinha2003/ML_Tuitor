import mongoose from 'mongoose'

export async function connectDatabase(uri: string) {
  mongoose.set('strictQuery', true)
  mongoose.set('bufferCommands', false)
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8_000,
    connectTimeoutMS: 8_000,
  })
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
}
