import { relations } from 'drizzle-orm'
import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const residences = sqliteTable('residences', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
})

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  createdAt: text('created_at').notNull(),
})

export const memberships = sqliteTable(
  'memberships',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id),
    residenceId: text('residence_id')
      .notNull()
      .references(() => residences.id),
    role: text('role', { enum: ['resident', 'manager'] }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('memberships_user_residence_idx').on(
      table.userId,
      table.residenceId,
    ),
  ],
)

export const problems = sqliteTable('problems', {
  id: text('id').primaryKey(),
  residenceId: text('residence_id')
    .notNull()
    .references(() => residences.id),
  reporterUserId: text('reporter_user_id')
    .notNull()
    .references(() => profiles.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  unit: text('unit'),
  category: text('category', {
    enum: ['maintenance', 'facilities', 'safety', 'noise', 'other'],
  }),
  status: text('status', {
    enum: [
      'submitted',
      'acknowledged',
      'in_progress',
      'resolved',
      'closed',
      'rejected',
    ],
  })
    .notNull()
    .default('submitted'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  statusChangedAt: text('status_changed_at').notNull(),
})

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  problemId: text('problem_id')
    .notNull()
    .references(() => problems.id),
  residenceId: text('residence_id')
    .notNull()
    .references(() => residences.id),
  authorUserId: text('author_user_id')
    .notNull()
    .references(() => profiles.id),
  body: text('body').notNull(),
  createdAt: text('created_at').notNull(),
})

export const residencesRelations = relations(residences, ({ many }) => ({
  memberships: many(memberships),
  problems: many(problems),
}))

export const profilesRelations = relations(profiles, ({ many }) => ({
  memberships: many(memberships),
  problems: many(problems),
  comments: many(comments),
}))
