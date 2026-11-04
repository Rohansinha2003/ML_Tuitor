import mongoose from 'mongoose'

export type DatabaseFailure = 'not-configured' | 'authentication' | 'network' | 'unknown'

let connection: Promise<void> | null = null
let lastFailure: DatabaseFailure | null = null

mongoose.set('strictQuery', true)
mongoose.set('bufferCommands', false)

function classifyFailure(error: unknown): DatabaseFailure {
  const message = error instanceof Error ? error.message : String(error)
  if (/authentication failed|bad auth/i.test(message)) return 'authentication'
  if (/whitelist|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|querySrv|Server selection timed out|ReplicaSetNoPrimary|Could not connect/i.test(message)) return 'network'
  return 'unknown'
}

/** Connects once per process and reconnects after a drop, so warm serverless instances reuse one pool. */
export async function connectDatabase(uri: string | undefined) {
  if (!uri) {
    lastFailure = 'not-configured'
    throw new Error('MONGODB_URI is not configured')
  }
  if (mongoose.connection.readyState === 1) return
  connection ??= mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8_000,
    connectTimeoutMS: 8_000,
    maxPoolSize: 10,
  }).then(() => {
    lastFailure = null
  }).catch((error: unknown) => {
    lastFailure = classifyFailure(error)
    throw new Error(`MongoDB connection failed (${lastFailure})`, { cause: error })
  }).finally(() => {
    connection = null
  })
  await connection
}

export function databaseStatus() {
  const connected = mongoose.connection.readyState === 1
  return { database: connected ? 'connected' as const : 'disconnected' as const, ...(!connected && lastFailure ? { databaseIssue: lastFailure } : {}) }
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
}
