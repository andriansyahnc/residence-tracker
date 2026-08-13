import { and, eq, inArray } from 'drizzle-orm'
import { AppError } from '../domain/errors'
import { computeDueAmountIdr, computeSaldoTotal, sumVerifiedIncome } from '../domain/ipl-money'
import {
  validateExpenseInput,
  validateFeePerM2,
  validateLuas,
  validateProofMeta,
  validateReviewNoteForReject,
  validateYearMonth,
} from '../domain/ipl-validation'
import { canIplStaff } from '../domain/permissions'
import type { Membership, SessionUser } from '../domain/types'
import type { AppDatabase } from '../db'
import { createTestDb, getDb } from '../db'
import {
  expenses,
  iplDues,
  iplPaymentProofs,
  iplPeriods,
  iplRates,
  luasChangeRequests,
  managementGroupResidences,
  memberships,
  monthlyReports,
  residences,
  unitMemberships,
  units,
} from '../db/schema'

type Db = AppDatabase

function nowIso() {
  return new Date().toISOString()
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function membershipFor(user: SessionUser): Membership {
  return {
    userId: user.userId,
    residenceId: user.residenceId,
    role: user.role,
  }
}

function requireIplStaff(user: SessionUser) {
  if (!canIplStaff(membershipFor(user))) {
    throw new AppError('FORBIDDEN', 'IPL staff only')
  }
}

export type BlobAdapter = {
  put: (key: string, bytes: Uint8Array, contentType: string) => Promise<void>
  get: (key: string) => Promise<Uint8Array | null>
}

function memoryBlobAdapter(): BlobAdapter {
  const map = new Map<string, { bytes: Uint8Array; contentType: string }>()
  return {
    async put(key, bytes, contentType) {
      map.set(key, { bytes, contentType })
    },
    async get(key) {
      return map.get(key)?.bytes ?? null
    },
  }
}

export function createIplStore(db: Db, blobs: BlobAdapter = memoryBlobAdapter()) {
  async function resolveManagementGroupId(residenceId: string) {
    const [link] = await db
      .select()
      .from(managementGroupResidences)
      .where(eq(managementGroupResidences.residenceId, residenceId))
      .limit(1)
    if (!link) {
      throw new AppError('NOT_FOUND', 'Residence not in a management group')
    }
    return link.managementGroupId
  }

  async function groupResidenceIds(managementGroupId: string) {
    const rows = await db
      .select()
      .from(managementGroupResidences)
      .where(eq(managementGroupResidences.managementGroupId, managementGroupId))
    return rows.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async function requireOpenPeriod(periodId: string) {
    const [period] = await db
      .select()
      .from(iplPeriods)
      .where(eq(iplPeriods.id, periodId))
      .limit(1)
    if (!period) throw new AppError('NOT_FOUND', 'Period not found')
    if (period.status === 'closed') {
      throw new AppError('VALIDATION', 'Period is closed')
    }
    return period
  }

  async function membershipIdFor(user: SessionUser) {
    const [row] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, user.userId),
          eq(memberships.residenceId, user.residenceId),
        ),
      )
      .limit(1)
    if (!row) throw new AppError('FORBIDDEN', 'No membership')
    return row.id
  }

  async function userUnitIds(user: SessionUser) {
    const membershipId = await membershipIdFor(user)
    const rows = await db
      .select()
      .from(unitMemberships)
      .where(eq(unitMemberships.membershipId, membershipId))
    return rows.map((r) => r.unitId)
  }

  return {
    async setFeePerM2(user: SessionUser, residenceId: string, fee: number) {
      requireIplStaff(user)
      const validated = validateFeePerM2(fee)
      if (!validated.ok) throw new AppError('VALIDATION', validated.error)
      const groupId = await resolveManagementGroupId(user.residenceId)
      const allowed = await groupResidenceIds(groupId)
      if (!allowed.some((r) => r.residenceId === residenceId)) {
        throw new AppError('FORBIDDEN', 'Residence outside management group')
      }
      const updatedAt = nowIso()
      await db
        .insert(iplRates)
        .values({
          residenceId,
          feePerM2Idr: validated.value,
          updatedAt,
          updatedByUserId: user.userId,
        })
        .onConflictDoUpdate({
          target: iplRates.residenceId,
          set: {
            feePerM2Idr: validated.value,
            updatedAt,
            updatedByUserId: user.userId,
          },
        })
      return { residenceId, feePerM2Idr: validated.value }
    },

    async upsertUnit(
      user: SessionUser,
      input: { residenceId: string; label: string; luasTanahM2: number },
    ) {
      requireIplStaff(user)
      const luas = validateLuas(input.luasTanahM2)
      if (!luas.ok) throw new AppError('VALIDATION', luas.error)
      const label = input.label.trim()
      if (!label || label.length > 50) {
        throw new AppError('VALIDATION', 'label required (max 50)')
      }
      const groupId = await resolveManagementGroupId(user.residenceId)
      const allowed = await groupResidenceIds(groupId)
      if (!allowed.some((r) => r.residenceId === input.residenceId)) {
        throw new AppError('FORBIDDEN', 'Residence outside management group')
      }
      const timestamp = nowIso()
      const [existing] = await db
        .select()
        .from(units)
        .where(
          and(eq(units.residenceId, input.residenceId), eq(units.label, label)),
        )
        .limit(1)
      if (existing) {
        await db
          .update(units)
          .set({ luasTanahM2: luas.value, updatedAt: timestamp })
          .where(eq(units.id, existing.id))
        return { ...existing, luasTanahM2: luas.value, updatedAt: timestamp }
      }
      const row = {
        id: id('unit'),
        residenceId: input.residenceId,
        label,
        luasTanahM2: luas.value,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await db.insert(units).values(row)
      return row
    },

    async openPeriod(user: SessionUser, yearMonthRaw: string) {
      requireIplStaff(user)
      const ym = validateYearMonth(yearMonthRaw)
      if (!ym.ok) throw new AppError('VALIDATION', ym.error)
      const managementGroupId = await resolveManagementGroupId(user.residenceId)
      const [existing] = await db
        .select()
        .from(iplPeriods)
        .where(
          and(
            eq(iplPeriods.managementGroupId, managementGroupId),
            eq(iplPeriods.yearMonth, ym.value),
          ),
        )
        .limit(1)
      if (existing) {
        throw new AppError('CONFLICT', 'Period already open for this month')
      }

      const residenceLinks = await groupResidenceIds(managementGroupId)
      const residenceIds = residenceLinks.map((r) => r.residenceId)
      const unitRows = await db
        .select()
        .from(units)
        .where(inArray(units.residenceId, residenceIds))
      if (unitRows.length === 0) {
        throw new AppError('VALIDATION', 'No units to bill')
      }

      const rateRows = await db
        .select()
        .from(iplRates)
        .where(inArray(iplRates.residenceId, residenceIds))
      const rateByResidence = new Map(
        rateRows.map((r) => [r.residenceId, r.feePerM2Idr]),
      )
      for (const residenceId of residenceIds) {
        if (!rateByResidence.has(residenceId)) {
          throw new AppError(
            'VALIDATION',
            `Missing fee rate for residence ${residenceId}`,
          )
        }
      }
      for (const unit of unitRows) {
        if (!(unit.luasTanahM2 > 0)) {
          throw new AppError('VALIDATION', `Unit ${unit.label} missing luas`)
        }
      }

      const openedAt = nowIso()
      const period = {
        id: id('period'),
        managementGroupId,
        yearMonth: ym.value,
        status: 'open' as const,
        openedAt,
        openedByUserId: user.userId,
      }
      await db.insert(iplPeriods).values(period)

      const dues = unitRows.map((unit) => {
        const fee = rateByResidence.get(unit.residenceId)!
        const amountIdr = computeDueAmountIdr(unit.luasTanahM2, fee)
        return {
          id: id('due'),
          periodId: period.id,
          unitId: unit.id,
          residenceId: unit.residenceId,
          luasSnapshotM2: unit.luasTanahM2,
          feePerM2SnapshotIdr: fee,
          amountIdr,
          createdAt: openedAt,
        }
      })
      await db.insert(iplDues).values(dues)
      return { period, dues }
    },

    async listMyDues(user: SessionUser, yearMonth?: string) {
      const unitIds = await userUnitIds(user)
      if (unitIds.length === 0) return []
      const managementGroupId = await resolveManagementGroupId(user.residenceId)
      let periodFilter = yearMonth
        ? (
            await db
              .select()
              .from(iplPeriods)
              .where(
                and(
                  eq(iplPeriods.managementGroupId, managementGroupId),
                  eq(iplPeriods.yearMonth, yearMonth),
                ),
              )
              .limit(1)
          )[0]
        : (
            await db
              .select()
              .from(iplPeriods)
              .where(eq(iplPeriods.managementGroupId, managementGroupId))
          ).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0]

      if (!periodFilter) return []
      const dues = await db
        .select()
        .from(iplDues)
        .where(
          and(
            eq(iplDues.periodId, periodFilter.id),
            inArray(iplDues.unitId, unitIds),
          ),
        )
      return dues.map((d) => ({ ...d, yearMonth: periodFilter!.yearMonth }))
    },

    async uploadProof(
      user: SessionUser,
      dueId: string,
      file: { bytes: Uint8Array; mimeType: string },
    ) {
      const meta = validateProofMeta({
        mimeType: file.mimeType,
        byteSize: file.bytes.byteLength,
      })
      if (!meta.ok) throw new AppError('VALIDATION', meta.error)

      const [due] = await db
        .select()
        .from(iplDues)
        .where(eq(iplDues.id, dueId))
        .limit(1)
      if (!due) throw new AppError('NOT_FOUND', 'Due not found')

      const period = await requireOpenPeriod(due.periodId)
      const unitIds = await userUnitIds(user)
      if (!unitIds.includes(due.unitId)) {
        throw new AppError('FORBIDDEN', 'Not your unit')
      }

      const [active] = await db
        .select()
        .from(iplPaymentProofs)
        .where(
          and(
            eq(iplPaymentProofs.dueId, dueId),
            inArray(iplPaymentProofs.status, ['pending', 'verified']),
          ),
        )
        .limit(1)
      if (active) {
        throw new AppError('CONFLICT', 'Active proof already exists')
      }

      const [unit] = await db
        .select()
        .from(units)
        .where(eq(units.id, due.unitId))
        .limit(1)
      if (!unit) throw new AppError('NOT_FOUND', 'Unit not found')

      const proofId = id('proof')
      const ext =
        meta.value.mimeType === 'image/png'
          ? 'png'
          : meta.value.mimeType === 'image/webp'
            ? 'webp'
            : 'jpg'
      const blobKey = `${due.residenceId}/${unit.label}/${period.yearMonth}/${proofId}.${ext}`
      await blobs.put(blobKey, file.bytes, meta.value.mimeType)
      const row = {
        id: proofId,
        dueId,
        blobKey,
        mimeType: meta.value.mimeType,
        byteSize: meta.value.byteSize,
        status: 'pending' as const,
        uploadedByUserId: user.userId,
        uploadedAt: nowIso(),
        reviewedByUserId: null as string | null,
        reviewedAt: null as string | null,
        reviewNote: null as string | null,
      }
      await db.insert(iplPaymentProofs).values(row)
      return row
    },

    async reviewProof(
      user: SessionUser,
      proofId: string,
      input: { status: 'verified' | 'rejected'; reviewNote?: string },
    ) {
      requireIplStaff(user)
      const note = validateReviewNoteForReject(input.status, input.reviewNote)
      if (!note.ok) throw new AppError('VALIDATION', note.error)

      const [proof] = await db
        .select()
        .from(iplPaymentProofs)
        .where(eq(iplPaymentProofs.id, proofId))
        .limit(1)
      if (!proof) throw new AppError('NOT_FOUND', 'Proof not found')
      if (proof.status !== 'pending') {
        throw new AppError('CONFLICT', 'Proof already reviewed')
      }

      const [due] = await db
        .select()
        .from(iplDues)
        .where(eq(iplDues.id, proof.dueId))
        .limit(1)
      if (!due) throw new AppError('NOT_FOUND', 'Due not found')
      await requireOpenPeriod(due.periodId)

      const reviewedAt = nowIso()
      await db
        .update(iplPaymentProofs)
        .set({
          status: input.status,
          reviewedByUserId: user.userId,
          reviewedAt,
          reviewNote: note.value ?? null,
        })
        .where(eq(iplPaymentProofs.id, proofId))
      return { ...proof, status: input.status, reviewedAt, reviewNote: note.value }
    },

    async listPendingProofs(user: SessionUser) {
      requireIplStaff(user)
      const managementGroupId = await resolveManagementGroupId(user.residenceId)
      const residenceIds = (await groupResidenceIds(managementGroupId)).map(
        (r) => r.residenceId,
      )
      const dues = await db
        .select()
        .from(iplDues)
        .where(inArray(iplDues.residenceId, residenceIds))
      const dueIds = dues.map((d) => d.id)
      if (dueIds.length === 0) return []
      return db
        .select()
        .from(iplPaymentProofs)
        .where(
          and(
            inArray(iplPaymentProofs.dueId, dueIds),
            eq(iplPaymentProofs.status, 'pending'),
          ),
        )
    },

    async requestLuasChange(
      user: SessionUser,
      unitId: string,
      proposedLuas: number,
    ) {
      const luas = validateLuas(proposedLuas)
      if (!luas.ok) throw new AppError('VALIDATION', luas.error)
      const unitIds = await userUnitIds(user)
      if (!unitIds.includes(unitId)) {
        throw new AppError('FORBIDDEN', 'Not your unit')
      }
      const [pending] = await db
        .select()
        .from(luasChangeRequests)
        .where(
          and(
            eq(luasChangeRequests.unitId, unitId),
            eq(luasChangeRequests.status, 'pending'),
          ),
        )
        .limit(1)
      if (pending) {
        throw new AppError('CONFLICT', 'Pending luas request already exists')
      }
      const row = {
        id: id('luas'),
        unitId,
        proposedLuasM2: luas.value,
        status: 'pending' as const,
        requestedByUserId: user.userId,
        requestedAt: nowIso(),
        reviewedByUserId: null as string | null,
        reviewedAt: null as string | null,
        reviewNote: null as string | null,
      }
      await db.insert(luasChangeRequests).values(row)
      return row
    },

    async reviewLuasChange(
      user: SessionUser,
      requestId: string,
      decision: 'approved' | 'rejected',
      reviewNote?: string,
    ) {
      requireIplStaff(user)
      const [req] = await db
        .select()
        .from(luasChangeRequests)
        .where(eq(luasChangeRequests.id, requestId))
        .limit(1)
      if (!req) throw new AppError('NOT_FOUND', 'Request not found')
      if (req.status !== 'pending') {
        throw new AppError('CONFLICT', 'Request already reviewed')
      }
      const reviewedAt = nowIso()
      await db
        .update(luasChangeRequests)
        .set({
          status: decision,
          reviewedByUserId: user.userId,
          reviewedAt,
          reviewNote: reviewNote?.trim() || null,
        })
        .where(eq(luasChangeRequests.id, requestId))
      if (decision === 'approved') {
        await db
          .update(units)
          .set({ luasTanahM2: req.proposedLuasM2, updatedAt: reviewedAt })
          .where(eq(units.id, req.unitId))
      }
      return { ...req, status: decision, reviewedAt }
    },

    async addExpense(
      user: SessionUser,
      input: {
        periodId: string
        category: string
        amountIdr: number
        expenseDate: string
        note?: string
      },
    ) {
      requireIplStaff(user)
      const validated = validateExpenseInput(input)
      if (!validated.ok) throw new AppError('VALIDATION', validated.error)
      const period = await requireOpenPeriod(input.periodId)
      if (!validated.value.expenseDate.startsWith(period.yearMonth)) {
        throw new AppError('VALIDATION', 'expense_date must be in period month')
      }
      const timestamp = nowIso()
      const row = {
        id: id('exp'),
        managementGroupId: period.managementGroupId,
        periodId: period.id,
        category: validated.value.category,
        amountIdr: validated.value.amountIdr,
        expenseDate: validated.value.expenseDate,
        note: validated.value.note ?? null,
        receiptBlobKey: null as string | null,
        receiptMimeType: null as 'image/jpeg' | 'image/png' | 'image/webp' | null,
        receiptByteSize: null as number | null,
        createdByUserId: user.userId,
        updatedByUserId: user.userId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await db.insert(expenses).values(row)
      return row
    },

    async upsertKeterangan(user: SessionUser, periodId: string, text: string) {
      requireIplStaff(user)
      await requireOpenPeriod(periodId)
      const keterangan = text.trim()
      if (keterangan.length > 5000) {
        throw new AppError('VALIDATION', 'keterangan too long')
      }
      const updatedAt = nowIso()
      await db
        .insert(monthlyReports)
        .values({
          periodId,
          keterangan,
          updatedAt,
          updatedByUserId: user.userId,
        })
        .onConflictDoUpdate({
          target: monthlyReports.periodId,
          set: { keterangan, updatedAt, updatedByUserId: user.userId },
        })
      return { periodId, keterangan }
    },

    async getMonthlyReport(user: SessionUser, yearMonthRaw: string) {
      const ym = validateYearMonth(yearMonthRaw)
      if (!ym.ok) throw new AppError('VALIDATION', ym.error)
      const managementGroupId = await resolveManagementGroupId(user.residenceId)
      const [period] = await db
        .select()
        .from(iplPeriods)
        .where(
          and(
            eq(iplPeriods.managementGroupId, managementGroupId),
            eq(iplPeriods.yearMonth, ym.value),
          ),
        )
        .limit(1)
      if (!period) throw new AppError('NOT_FOUND', 'Period not found')

      const links = await groupResidenceIds(managementGroupId)
      const dues = await db
        .select()
        .from(iplDues)
        .where(eq(iplDues.periodId, period.id))
      const proofs = await db
        .select()
        .from(iplPaymentProofs)
        .where(
          inArray(
            iplPaymentProofs.dueId,
            dues.map((d) => d.id).concat(['__none__']),
          ),
        )
      const verifiedDueIds = new Set(
        proofs.filter((p) => p.status === 'verified').map((p) => p.dueId),
      )
      const income = sumVerifiedIncome(
        dues.map((d) => ({
          residenceId: d.residenceId,
          amountIdr: d.amountIdr,
          verified: verifiedDueIds.has(d.id),
        })),
      )
      const expenseRows = await db
        .select()
        .from(expenses)
        .where(eq(expenses.periodId, period.id))
      const expenseTotal = expenseRows.reduce((a, e) => a + e.amountIdr, 0)
      const residenceRows = await db
        .select()
        .from(residences)
        .where(
          inArray(
            residences.id,
            links.map((l) => l.residenceId),
          ),
        )
      const nameById = new Map(residenceRows.map((r) => [r.id, r.name]))
      const residencesOut = links.map((l) => ({
        id: l.residenceId,
        name: nameById.get(l.residenceId) ?? l.residenceId,
        sortOrder: l.sortOrder,
        incomeIdr: income.byResidence[l.residenceId] ?? 0,
      }))
      const [report] = await db
        .select()
        .from(monthlyReports)
        .where(eq(monthlyReports.periodId, period.id))
        .limit(1)
      return {
        yearMonth: period.yearMonth,
        periodId: period.id,
        residences: residencesOut,
        expenses: expenseRows,
        saldoTotalIdr: computeSaldoTotal(
          residencesOut.map((r) => r.incomeIdr),
          expenseTotal,
        ),
        keterangan: report?.keterangan ?? '',
      }
    },

    async importUnitsCsv(user: SessionUser, csv: string) {
      requireIplStaff(user)
      const lines = csv
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      if (lines.length < 2) {
        throw new AppError('VALIDATION', 'CSV needs header and rows')
      }
      const header = lines[0].split(',').map((h) => h.trim())
      if (
        header.join(',') !== 'residence_id,label,luas_tanah_m2'
      ) {
        throw new AppError(
          'VALIDATION',
          'CSV header must be residence_id,label,luas_tanah_m2',
        )
      }
      const errors: string[] = []
      let imported = 0
      for (let i = 1; i < lines.length; i++) {
        const [residenceId, label, luasRaw] = lines[i].split(',').map((c) => c.trim())
        const luas = Number(luasRaw)
        try {
          await this.upsertUnit(user, {
            residenceId,
            label,
            luasTanahM2: luas,
          })
          imported++
        } catch (e) {
          errors.push(`line ${i + 1}: ${e instanceof Error ? e.message : 'error'}`)
        }
      }
      return { imported, errors }
    },

    getBlob(key: string) {
      return blobs.get(key)
    },
  }
}

let singleton: ReturnType<typeof createIplStore> | null = null

export function getIplStore() {
  if (!singleton) {
    singleton = createIplStore(getDb())
  }
  return singleton
}

export async function createTestIplStore() {
  return createIplStore(await createTestDb(), memoryBlobAdapter())
}
