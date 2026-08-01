import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { getConnectionString } from '@netlify/database'
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import pg from 'pg'
import * as schema from './schema'
import { seedDatabase } from './seed'

export type AppDatabase =
  | ReturnType<typeof drizzleNodePg<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>

let db: AppDatabase | null = null
let pool: pg.Pool | null = null

function resolveConnectionString() {
  if (process.env.NETLIFY_DB_URL) {
    return process.env.NETLIFY_DB_URL
  }
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }
  return getConnectionString()
}

export function getDb(): AppDatabase {
  if (!db) {
    pool = new pg.Pool({ connectionString: resolveConnectionString() })
    db = drizzleNodePg(pool, { schema })
  }
  return db
}

async function applySqlMigrations(client: PGlite) {
  const dir = join(process.cwd(), 'netlify/database/migrations')
  const files = readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
  for (const file of files) {
    await client.exec(readFileSync(join(dir, file), 'utf8'))
  }
}

export async function createTestDb(): Promise<AppDatabase> {
  const client = new PGlite()
  await applySqlMigrations(client)
  const database = drizzlePglite(client, { schema })
  await seedDatabase(database)
  return database
}

export async function resetDbForTests() {
  if (pool) {
    await pool.end()
  }
  db = null
  pool = null
}

export { schema }
