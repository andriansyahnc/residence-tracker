import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { getConnectionString } from '@netlify/database'
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres'
import type { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import pg from 'pg'
import * as schema from './schema'

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

export async function resetDbForTests() {
  if (pool) {
    await pool.end()
  }
  db = null
  pool = null
}

export { schema }

/** Test-only helper — kept in this module's sibling to avoid bundling PGlite in production. */
export async function createTestDb(): Promise<AppDatabase> {
  const { createTestDb: create } = await import('./test-db')
  return create()
}
