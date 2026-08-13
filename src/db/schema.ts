import { relations } from 'drizzle-orm'
import {
  bigint,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const residences = pgTable('residences', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
})

export const profiles = pgTable(
  'profiles',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('profiles_email_unique').on(table.email)],
)

export const memberships = pgTable(
  'memberships',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id),
    residenceId: text('residence_id')
      .notNull()
      .references(() => residences.id),
    role: text('role', { enum: ['resident', 'manager', 'accountant'] }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('memberships_user_residence_idx').on(
      table.userId,
      table.residenceId,
    ),
  ],
)

export const problems = pgTable('problems', {
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

export const comments = pgTable('comments', {
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

export const managementGroups = pgTable('management_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
})

export const managementGroupResidences = pgTable(
  'management_group_residences',
  {
    managementGroupId: text('management_group_id')
      .notNull()
      .references(() => managementGroups.id),
    residenceId: text('residence_id')
      .notNull()
      .references(() => residences.id),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.managementGroupId, t.residenceId] }),
    uniqueIndex('mgr_residence_unique').on(t.residenceId),
    uniqueIndex('mgr_sort_unique').on(t.managementGroupId, t.sortOrder),
  ],
)

export const units = pgTable(
  'units',
  {
    id: text('id').primaryKey(),
    residenceId: text('residence_id')
      .notNull()
      .references(() => residences.id),
    label: text('label').notNull(),
    luasTanahM2: numeric('luas_tanah_m2', {
      precision: 10,
      scale: 2,
      mode: 'number',
    }).notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('units_residence_label_unique').on(t.residenceId, t.label)],
)

export const unitMemberships = pgTable(
  'unit_memberships',
  {
    id: text('id').primaryKey(),
    unitId: text('unit_id')
      .notNull()
      .references(() => units.id),
    membershipId: text('membership_id')
      .notNull()
      .references(() => memberships.id),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('unit_memberships_unit_membership_unique').on(
      t.unitId,
      t.membershipId,
    ),
    index('unit_memberships_membership_idx').on(t.membershipId),
  ],
)

export const iplRates = pgTable('ipl_rates', {
  residenceId: text('residence_id')
    .primaryKey()
    .references(() => residences.id),
  feePerM2Idr: bigint('fee_per_m2_idr', { mode: 'number' }).notNull(),
  updatedAt: text('updated_at').notNull(),
  updatedByUserId: text('updated_by_user_id')
    .notNull()
    .references(() => profiles.id),
})

export const iplPeriods = pgTable(
  'ipl_periods',
  {
    id: text('id').primaryKey(),
    managementGroupId: text('management_group_id')
      .notNull()
      .references(() => managementGroups.id),
    yearMonth: text('year_month').notNull(),
    status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
    openedAt: text('opened_at').notNull(),
    openedByUserId: text('opened_by_user_id')
      .notNull()
      .references(() => profiles.id),
  },
  (t) => [
    uniqueIndex('ipl_periods_group_month_unique').on(
      t.managementGroupId,
      t.yearMonth,
    ),
  ],
)

export const iplDues = pgTable(
  'ipl_dues',
  {
    id: text('id').primaryKey(),
    periodId: text('period_id')
      .notNull()
      .references(() => iplPeriods.id),
    unitId: text('unit_id')
      .notNull()
      .references(() => units.id),
    residenceId: text('residence_id')
      .notNull()
      .references(() => residences.id),
    luasSnapshotM2: numeric('luas_snapshot_m2', {
      precision: 10,
      scale: 2,
      mode: 'number',
    }).notNull(),
    feePerM2SnapshotIdr: bigint('fee_per_m2_snapshot_idr', {
      mode: 'number',
    }).notNull(),
    amountIdr: bigint('amount_idr', { mode: 'number' }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('ipl_dues_period_unit_unique').on(t.periodId, t.unitId),
    index('ipl_dues_period_residence_idx').on(t.periodId, t.residenceId),
  ],
)

export const iplPaymentProofs = pgTable(
  'ipl_payment_proofs',
  {
    id: text('id').primaryKey(),
    dueId: text('due_id')
      .notNull()
      .references(() => iplDues.id),
    blobKey: text('blob_key').notNull(),
    mimeType: text('mime_type', {
      enum: ['image/jpeg', 'image/png', 'image/webp'],
    }).notNull(),
    byteSize: integer('byte_size').notNull(),
    status: text('status', {
      enum: ['pending', 'verified', 'rejected'],
    }).notNull(),
    uploadedByUserId: text('uploaded_by_user_id')
      .notNull()
      .references(() => profiles.id),
    uploadedAt: text('uploaded_at').notNull(),
    reviewedByUserId: text('reviewed_by_user_id').references(() => profiles.id),
    reviewedAt: text('reviewed_at'),
    reviewNote: text('review_note'),
  },
  (t) => [
    index('ipl_payment_proofs_due_idx').on(t.dueId),
    index('ipl_payment_proofs_status_uploaded_idx').on(t.status, t.uploadedAt),
  ],
)

export const luasChangeRequests = pgTable('luas_change_requests', {
  id: text('id').primaryKey(),
  unitId: text('unit_id')
    .notNull()
    .references(() => units.id),
  proposedLuasM2: numeric('proposed_luas_m2', {
    precision: 10,
    scale: 2,
    mode: 'number',
  }).notNull(),
  status: text('status', {
    enum: ['pending', 'approved', 'rejected'],
  }).notNull(),
  requestedByUserId: text('requested_by_user_id')
    .notNull()
    .references(() => profiles.id),
  requestedAt: text('requested_at').notNull(),
  reviewedByUserId: text('reviewed_by_user_id').references(() => profiles.id),
  reviewedAt: text('reviewed_at'),
  reviewNote: text('review_note'),
})

export const expenses = pgTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    managementGroupId: text('management_group_id')
      .notNull()
      .references(() => managementGroups.id),
    periodId: text('period_id')
      .notNull()
      .references(() => iplPeriods.id),
    category: text('category').notNull(),
    amountIdr: bigint('amount_idr', { mode: 'number' }).notNull(),
    expenseDate: text('expense_date').notNull(),
    note: text('note'),
    receiptBlobKey: text('receipt_blob_key'),
    receiptMimeType: text('receipt_mime_type', {
      enum: ['image/jpeg', 'image/png', 'image/webp'],
    }),
    receiptByteSize: integer('receipt_byte_size'),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => profiles.id),
    updatedByUserId: text('updated_by_user_id')
      .notNull()
      .references(() => profiles.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('expenses_period_date_idx').on(t.periodId, t.expenseDate)],
)

export const monthlyReports = pgTable('monthly_reports', {
  periodId: text('period_id')
    .primaryKey()
    .references(() => iplPeriods.id),
  keterangan: text('keterangan').notNull().default(''),
  updatedAt: text('updated_at').notNull(),
  updatedByUserId: text('updated_by_user_id')
    .notNull()
    .references(() => profiles.id),
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
