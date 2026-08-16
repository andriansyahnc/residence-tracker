import { eq, like } from 'drizzle-orm'
import type { AppDatabase } from './index'
import { DEMO_RESIDENCE_ID } from '../domain/constants'
import { computeDueAmountIdr } from '../domain/ipl-money'
import {
  comments,
  expenses,
  iplDues,
  iplPaymentProofs,
  iplPeriods,
  iplRates,
  luasChangeRequests,
  managementGroupResidences,
  managementGroups,
  memberships,
  monthlyReports,
  problems,
  profiles,
  residences,
  unitMemberships,
  units,
} from './schema'

/**
 * The demo org: one management group holding one residence, everything prefixed
 * `demo-`. Periods, expenses and monthly reports are scoped by management group,
 * so the demo needs its own group to stay separable from real data.
 */
export { DEMO_RESIDENCE_ID } from '../domain/constants'
export const DEMO_GROUP_ID = 'mg-demo'

export const DEMO_MANAGER_EMAIL = 'demo.manager@example.com'
export const DEMO_RESIDENT_EMAIL = 'demo.warga@example.com'
export const DEMO_ACCOUNTANT_EMAIL = 'demo.bendahara@example.com'

const MANAGER = 'demo-user-manager'
const RESIDENT = 'demo-user-warga'
const ACCOUNTANT = 'demo-user-bendahara'

const FEE_PER_M2 = 15000
const AT = '2026-06-01T00:00:00Z'

const DEMO_UNITS = [
  { id: 'demo-unit-a1', label: 'A1', luasTanahM2: 72 },
  { id: 'demo-unit-a2', label: 'A2', luasTanahM2: 84 },
  { id: 'demo-unit-a3', label: 'A3', luasTanahM2: 90 },
  { id: 'demo-unit-a4', label: 'A4', luasTanahM2: 96 },
  { id: 'demo-unit-b1', label: 'B1', luasTanahM2: 105 },
  { id: 'demo-unit-b2', label: 'B2', luasTanahM2: 110 },
  { id: 'demo-unit-b3', label: 'B3', luasTanahM2: 120 },
  { id: 'demo-unit-b4', label: 'B4', luasTanahM2: 132 },
]

const DEMO_PERIODS = [
  { id: 'demo-period-2026-06', yearMonth: '2026-06', status: 'closed' as const },
  { id: 'demo-period-2026-07', yearMonth: '2026-07', status: 'closed' as const },
  { id: 'demo-period-2026-08', yearMonth: '2026-08', status: 'open' as const },
]

/** Unit label -> proof state on the open period. Absent = no proof uploaded yet. */
const OPEN_PERIOD_PROOFS: Record<string, 'verified' | 'pending'> = {
  A1: 'verified',
  A2: 'verified',
  A3: 'verified',
  B1: 'pending',
  B2: 'pending',
}

/**
 * Migration 0004 already inserts the residence, group and the three accounts so
 * the demo users can sign in on a deployed site. The check below is on units,
 * which only this file writes — that is what tells us the full dataset is here.
 */
async function demoDataExists(db: AppDatabase) {
  const found = await db
    .select({ id: units.id })
    .from(units)
    .where(eq(units.residenceId, DEMO_RESIDENCE_ID))
    .limit(1)
  return found.length > 0
}

export async function seedDemoOrg(db: AppDatabase) {
  if (await demoDataExists(db)) return

  await db
    .insert(residences)
    .values({
      id: DEMO_RESIDENCE_ID,
      name: 'Griya Asri Demo',
      createdAt: AT,
    })
    .onConflictDoNothing()

  await db
    .insert(managementGroups)
    .values({
      id: DEMO_GROUP_ID,
      name: 'Pengurus Griya Asri Demo',
      createdAt: AT,
    })
    .onConflictDoNothing()

  await db
    .insert(managementGroupResidences)
    .values({
      managementGroupId: DEMO_GROUP_ID,
      residenceId: DEMO_RESIDENCE_ID,
      sortOrder: 1,
      createdAt: AT,
    })
    .onConflictDoNothing()

  await db.insert(profiles).values([
    {
      id: MANAGER,
      email: DEMO_MANAGER_EMAIL,
      displayName: 'Pak Budi (Ketua)',
      createdAt: AT,
    },
    {
      id: RESIDENT,
      email: DEMO_RESIDENT_EMAIL,
      displayName: 'Ibu Sari (Warga)',
      createdAt: AT,
    },
    {
      id: ACCOUNTANT,
      email: DEMO_ACCOUNTANT_EMAIL,
      displayName: 'Pak Anton (Bendahara)',
      createdAt: AT,
    },
  ]).onConflictDoNothing()

  // Only membership these users have, so login lands them in the demo residence.
  await db.insert(memberships).values([
    {
      id: 'demo-mem-manager',
      userId: MANAGER,
      residenceId: DEMO_RESIDENCE_ID,
      role: 'manager',
      createdAt: AT,
    },
    {
      id: 'demo-mem-warga',
      userId: RESIDENT,
      residenceId: DEMO_RESIDENCE_ID,
      role: 'resident',
      createdAt: AT,
    },
    {
      id: 'demo-mem-bendahara',
      userId: ACCOUNTANT,
      residenceId: DEMO_RESIDENCE_ID,
      role: 'accountant',
      createdAt: AT,
    },
  ]).onConflictDoNothing()

  await db.insert(iplRates).values({
    residenceId: DEMO_RESIDENCE_ID,
    feePerM2Idr: FEE_PER_M2,
    updatedAt: AT,
    updatedByUserId: MANAGER,
  })

  await db.insert(units).values(
    DEMO_UNITS.map((u) => ({
      ...u,
      residenceId: DEMO_RESIDENCE_ID,
      createdAt: AT,
      updatedAt: AT,
    })),
  )

  // Ibu Sari owns A1 so she sees her own bill on /ipl.
  await db.insert(unitMemberships).values([
    {
      id: 'demo-um-warga-a1',
      unitId: 'demo-unit-a1',
      membershipId: 'demo-mem-warga',
      createdAt: AT,
    },
    {
      id: 'demo-um-manager-b1',
      unitId: 'demo-unit-b1',
      membershipId: 'demo-mem-manager',
      createdAt: AT,
    },
  ])

  await db.insert(iplPeriods).values(
    DEMO_PERIODS.map((p) => ({
      id: p.id,
      managementGroupId: DEMO_GROUP_ID,
      yearMonth: p.yearMonth,
      status: p.status,
      openedAt: `${p.yearMonth}-01T00:00:00Z`,
      openedByUserId: MANAGER,
    })),
  )

  const dueRows = []
  const proofRows = []
  for (const period of DEMO_PERIODS) {
    for (const unit of DEMO_UNITS) {
      const dueId = `demo-due-${period.yearMonth}-${unit.label.toLowerCase()}`
      dueRows.push({
        id: dueId,
        periodId: period.id,
        unitId: unit.id,
        residenceId: DEMO_RESIDENCE_ID,
        luasSnapshotM2: unit.luasTanahM2,
        feePerM2SnapshotIdr: FEE_PER_M2,
        amountIdr: computeDueAmountIdr(unit.luasTanahM2, FEE_PER_M2),
        createdAt: `${period.yearMonth}-01T00:00:00Z`,
      })

      // Closed months are fully paid; the open month is mid-collection.
      const state =
        period.status === 'closed'
          ? 'verified'
          : OPEN_PERIOD_PROOFS[unit.label]
      if (!state) continue

      proofRows.push({
        id: `demo-proof-${period.yearMonth}-${unit.label.toLowerCase()}`,
        dueId,
        blobKey: `${DEMO_RESIDENCE_ID}/${unit.label}/${period.yearMonth}/demo.jpg`,
        mimeType: 'image/jpeg' as const,
        byteSize: 128000,
        status: state,
        uploadedByUserId: RESIDENT,
        uploadedAt: `${period.yearMonth}-05T09:00:00Z`,
        reviewedByUserId: state === 'verified' ? ACCOUNTANT : null,
        reviewedAt: state === 'verified' ? `${period.yearMonth}-06T09:00:00Z` : null,
        reviewNote: null,
      })
    }
  }
  await db.insert(iplDues).values(dueRows)
  await db.insert(iplPaymentProofs).values(proofRows)

  const expenseRows = []
  for (const period of DEMO_PERIODS) {
    const items = [
      { key: 'satpam', category: 'Keamanan', amountIdr: 4500000, note: 'Gaji 3 satpam' },
      { key: 'sampah', category: 'Kebersihan', amountIdr: 1200000, note: 'Angkut sampah' },
      { key: 'listrik', category: 'Utilitas', amountIdr: 850000, note: 'Listrik taman & pos' },
    ]
    for (const item of items) {
      expenseRows.push({
        id: `demo-exp-${period.yearMonth}-${item.key}`,
        managementGroupId: DEMO_GROUP_ID,
        periodId: period.id,
        category: item.category,
        amountIdr: item.amountIdr,
        expenseDate: `${period.yearMonth}-10`,
        note: item.note,
        receiptBlobKey: null,
        receiptMimeType: null,
        receiptByteSize: null,
        createdByUserId: ACCOUNTANT,
        updatedByUserId: ACCOUNTANT,
        createdAt: `${period.yearMonth}-10T00:00:00Z`,
        updatedAt: `${period.yearMonth}-10T00:00:00Z`,
      })
    }
  }
  await db.insert(expenses).values(expenseRows)

  await db.insert(monthlyReports).values(
    DEMO_PERIODS.map((p) => ({
      periodId: p.id,
      keterangan: `Laporan keuangan ${p.yearMonth}. Saldo dipakai untuk keamanan dan kebersihan.`,
      updatedAt: `${p.yearMonth}-28T00:00:00Z`,
      updatedByUserId: ACCOUNTANT,
    })),
  )

  await db.insert(luasChangeRequests).values({
    id: 'demo-luas-req-1',
    unitId: 'demo-unit-b4',
    proposedLuasM2: 138,
    status: 'pending',
    requestedByUserId: RESIDENT,
    requestedAt: '2026-08-04T03:00:00Z',
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNote: null,
  })

  await db.insert(problems).values([
    {
      id: 'demo-problem-1',
      residenceId: DEMO_RESIDENCE_ID,
      reporterUserId: RESIDENT,
      title: 'Lampu jalan depan blok A mati',
      description: 'Sudah tiga malam gelap, rawan untuk yang pulang malam.',
      unit: 'A1',
      category: 'safety',
      status: 'in_progress',
      createdAt: '2026-08-02T12:00:00Z',
      updatedAt: '2026-08-05T02:00:00Z',
      statusChangedAt: '2026-08-05T02:00:00Z',
    },
    {
      id: 'demo-problem-2',
      residenceId: DEMO_RESIDENCE_ID,
      reporterUserId: RESIDENT,
      title: 'Air keran keruh pagi hari',
      description: 'Air kuning kalau dinyalakan sebelum jam 7.',
      unit: 'A1',
      category: 'maintenance',
      status: 'submitted',
      createdAt: '2026-08-11T23:30:00Z',
      updatedAt: '2026-08-11T23:30:00Z',
      statusChangedAt: '2026-08-11T23:30:00Z',
    },
    {
      id: 'demo-problem-3',
      residenceId: DEMO_RESIDENCE_ID,
      reporterUserId: MANAGER,
      title: 'Portal masuk rusak',
      description: 'Palang portal tidak mau naik otomatis.',
      unit: 'B1',
      category: 'facilities',
      status: 'resolved',
      createdAt: '2026-07-18T04:00:00Z',
      updatedAt: '2026-07-24T04:00:00Z',
      statusChangedAt: '2026-07-24T04:00:00Z',
    },
    {
      id: 'demo-problem-4',
      residenceId: DEMO_RESIDENCE_ID,
      reporterUserId: MANAGER,
      title: 'Suara musik keras dini hari',
      description: 'Laporan dari beberapa warga blok B akhir pekan lalu.',
      unit: 'B3',
      category: 'noise',
      status: 'closed',
      createdAt: '2026-07-06T15:00:00Z',
      updatedAt: '2026-07-12T02:00:00Z',
      statusChangedAt: '2026-07-12T02:00:00Z',
    },
    {
      id: 'demo-problem-5',
      residenceId: DEMO_RESIDENCE_ID,
      reporterUserId: MANAGER,
      title: 'Minta pasang CCTV di pos dua',
      description: 'Ditolak sementara, anggaran belum ada di periode ini.',
      unit: null,
      category: 'other',
      status: 'rejected',
      createdAt: '2026-06-20T06:00:00Z',
      updatedAt: '2026-06-22T06:00:00Z',
      statusChangedAt: '2026-06-22T06:00:00Z',
    },
  ])

  await db.insert(comments).values([
    {
      id: 'demo-comment-1',
      problemId: 'demo-problem-1',
      residenceId: DEMO_RESIDENCE_ID,
      authorUserId: MANAGER,
      body: 'Sudah dilaporkan ke teknisi, dijadwalkan hari Sabtu.',
      createdAt: '2026-08-05T02:00:00Z',
    },
    {
      id: 'demo-comment-2',
      problemId: 'demo-problem-1',
      residenceId: DEMO_RESIDENCE_ID,
      authorUserId: RESIDENT,
      body: 'Terima kasih Pak, ditunggu.',
      createdAt: '2026-08-05T10:00:00Z',
    },
    {
      id: 'demo-comment-3',
      problemId: 'demo-problem-3',
      residenceId: DEMO_RESIDENCE_ID,
      authorUserId: MANAGER,
      body: 'Motor portal diganti, sudah normal.',
      createdAt: '2026-07-24T04:00:00Z',
    },
    {
      id: 'demo-comment-4',
      problemId: 'demo-problem-5',
      residenceId: DEMO_RESIDENCE_ID,
      authorUserId: MANAGER,
      body: 'Diajukan lagi setelah laporan bulan depan.',
      createdAt: '2026-06-22T06:00:00Z',
    },
  ])
}

/**
 * Deletes every row of the demo org. Child rows first — the schema declares no
 * `on delete cascade`, so order is what keeps the foreign keys happy.
 */
async function deleteDemoOrg(db: AppDatabase) {
  await db.delete(monthlyReports).where(like(monthlyReports.periodId, 'demo-%'))
  await db.delete(expenses).where(eq(expenses.managementGroupId, DEMO_GROUP_ID))
  await db.delete(iplPaymentProofs).where(like(iplPaymentProofs.id, 'demo-%'))
  await db.delete(iplDues).where(eq(iplDues.residenceId, DEMO_RESIDENCE_ID))
  await db.delete(iplPeriods).where(eq(iplPeriods.managementGroupId, DEMO_GROUP_ID))
  await db.delete(luasChangeRequests).where(like(luasChangeRequests.id, 'demo-%'))
  await db.delete(comments).where(eq(comments.residenceId, DEMO_RESIDENCE_ID))
  await db.delete(problems).where(eq(problems.residenceId, DEMO_RESIDENCE_ID))
  await db.delete(unitMemberships).where(like(unitMemberships.id, 'demo-%'))
  await db.delete(units).where(eq(units.residenceId, DEMO_RESIDENCE_ID))
  await db.delete(iplRates).where(eq(iplRates.residenceId, DEMO_RESIDENCE_ID))
  await db.delete(memberships).where(eq(memberships.residenceId, DEMO_RESIDENCE_ID))
  await db
    .delete(managementGroupResidences)
    .where(eq(managementGroupResidences.managementGroupId, DEMO_GROUP_ID))
  await db.delete(managementGroups).where(eq(managementGroups.id, DEMO_GROUP_ID))
  await db.delete(residences).where(eq(residences.id, DEMO_RESIDENCE_ID))
  await db.delete(profiles).where(like(profiles.id, 'demo-%'))
}

export async function resetDemoOrg(db: AppDatabase) {
  await deleteDemoOrg(db)
  await seedDemoOrg(db)
}
