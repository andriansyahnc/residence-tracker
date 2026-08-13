import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import type { AppDatabase } from './index'
import * as schema from './schema'
import { seedDatabase } from './seed'

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
