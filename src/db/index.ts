import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import { seedDatabase } from './seed'

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>

let db: AppDatabase | null = null
let sqlite: Database.Database | null = null

export function getDbPath() {
  return process.env.DATABASE_URL ?? 'data/residence-tracker.sqlite'
}

export function createDbConnection(path = getDbPath()): AppDatabase {
  const connection = new Database(path)
  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')
  const database = drizzle(connection, { schema })
  migrate(database, { migrationsFolder: 'drizzle' })
  seedDatabase(database)
  return database
}

export function getDb(): AppDatabase {
  if (!db) {
    sqlite = new Database(getDbPath())
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema })
    migrate(db, { migrationsFolder: 'drizzle' })
    seedDatabase(db)
  }
  return db
}

export function resetDbForTests() {
  if (sqlite) {
    sqlite.close()
  }
  db = null
  sqlite = null
}

export function createTestDb(): AppDatabase {
  const connection = new Database(':memory:')
  connection.pragma('foreign_keys = ON')
  const database = drizzle(connection, { schema })
  migrate(database, { migrationsFolder: 'drizzle' })
  seedDatabase(database)
  return database
}

export { schema }
