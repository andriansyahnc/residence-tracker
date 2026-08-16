import { describe, expect, it, beforeEach } from 'vitest'
import { AppError } from '../domain/errors'
import { createTestIplStore } from './ipl-store'
import type { SessionUser } from '../domain/types'

const resident: SessionUser = {
  userId: 'user-resident',
  email: 'resident@example.com',
  displayName: 'Alex Resident',
  residenceId: 'res-1',
  residenceName: 'Oak Residence',
  role: 'resident',
}

const manager: SessionUser = {
  userId: 'user-manager',
  email: 'manager@example.com',
  displayName: 'Morgan Manager',
  residenceId: 'res-1',
  residenceName: 'Oak Residence',
  role: 'manager',
}

const accountant: SessionUser = {
  userId: 'user-accountant',
  email: 'accountant@example.com',
  displayName: 'Ayu Accountant',
  residenceId: 'res-1',
  residenceName: 'Oak Residence',
  role: 'accountant',
}

const other: SessionUser = {
  userId: 'user-other',
  email: 'other@example.com',
  displayName: 'Other Resident',
  residenceId: 'res-1',
  residenceName: 'Oak Residence',
  role: 'resident',
}

describe('ipl-store', () => {
  let store: Awaited<ReturnType<typeof createTestIplStore>>

  beforeEach(async () => {
    store = await createTestIplStore()
  })

  it('snapshots due amount and ignores later fee changes', async () => {
    const { dues } = await store.openPeriod(manager, '2026-08')
    const due1a = dues.find((d) => d.unitId === 'unit-1a')!
    expect(due1a.amountIdr).toBe(1_000_000)
    await store.setFeePerM2(manager, 'res-1', 20000)
    const mine = await store.listMyDues(resident, '2026-08')
    expect(mine.find((d) => d.unitId === 'unit-1a')!.amountIdr).toBe(1_000_000)
  })

  it('listPeriods returns own group newest-first', async () => {
    await store.openPeriod(manager, '2026-07')
    await store.openPeriod(manager, '2026-08')

    const periods = await store.listPeriods(resident)

    expect(periods.map((p) => p.yearMonth)).toEqual(['2026-08', '2026-07'])
    // 2026-06 exists, but only in the demo management group.
    expect(periods.some((p) => p.yearMonth === '2026-06')).toBe(false)
  })

  it('duplicate openPeriod conflicts', async () => {
    await store.openPeriod(manager, '2026-08')
    await expect(store.openPeriod(manager, '2026-08')).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('only verified income enters report; combined saldo', async () => {
    const { period, dues } = await store.openPeriod(manager, '2026-08')
    const due1a = dues.find((d) => d.unitId === 'unit-1a')!
    const due2a = dues.find((d) => d.unitId === 'unit-2a')!
    const proof = await store.uploadProof(resident, due1a.id, {
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/jpeg',
    })
    await store.reviewProof(accountant, proof.id, { status: 'verified' })
    // pending/unverified 2a should not count
    await store.uploadProof(
      { ...resident, residenceId: 'res-2', residenceName: 'Pine Residence' },
      due2a.id,
      { bytes: new Uint8Array([1]), mimeType: 'image/jpeg' },
    )
    await store.addExpense(manager, {
      periodId: period.id,
      category: 'Kebersihan',
      amountIdr: 100_000,
      expenseDate: '2026-08-05',
    })
    const report = await store.getMonthlyReport(resident, '2026-08')
    expect(report.residences.find((r) => r.id === 'res-1')!.incomeIdr).toBe(
      1_000_000,
    )
    expect(report.residences.find((r) => r.id === 'res-2')!.incomeIdr).toBe(0)
    expect(report.saldoTotalIdr).toBe(900_000)
  })

  it('reject then re-upload; second pending blocked; blob keys differ by unit', async () => {
    const { dues } = await store.openPeriod(manager, '2026-08')
    const due1a = dues.find((d) => d.unitId === 'unit-1a')!
    const due1b = dues.find((d) => d.unitId === 'unit-1b')!
    const p1 = await store.uploadProof(resident, due1a.id, {
      bytes: new Uint8Array([1]),
      mimeType: 'image/jpeg',
    })
    expect(p1.blobKey.startsWith('res-1/1A/2026-08/')).toBe(true)
    await expect(
      store.uploadProof(resident, due1a.id, {
        bytes: new Uint8Array([1]),
        mimeType: 'image/jpeg',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    await store.reviewProof(manager, p1.id, {
      status: 'rejected',
      reviewNote: 'blur',
    })
    const p2 = await store.uploadProof(resident, due1a.id, {
      bytes: new Uint8Array([2]),
      mimeType: 'image/png',
    })
    expect(p2.status).toBe('pending')
    const otherProof = await store.uploadProof(other, due1b.id, {
      bytes: new Uint8Array([3]),
      mimeType: 'image/webp',
    })
    expect(otherProof.blobKey.startsWith('res-1/1B/2026-08/')).toBe(true)
  })

  it('resident cannot verify or add expense; accountant can', async () => {
    const { period, dues } = await store.openPeriod(manager, '2026-08')
    const due1a = dues.find((d) => d.unitId === 'unit-1a')!
    const proof = await store.uploadProof(resident, due1a.id, {
      bytes: new Uint8Array([1]),
      mimeType: 'image/jpeg',
    })
    await expect(
      store.reviewProof(resident, proof.id, { status: 'verified' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      store.addExpense(resident, {
        periodId: period.id,
        category: 'X',
        amountIdr: 1,
        expenseDate: '2026-08-01',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await store.reviewProof(accountant, proof.id, { status: 'verified' })
  })

  it('approved luas applies to next period only', async () => {
    const first = await store.openPeriod(manager, '2026-08')
    const due1a = first.dues.find((d) => d.unitId === 'unit-1a')!
    expect(due1a.luasSnapshotM2).toBe(100)
    const req = await store.requestLuasChange(resident, 'unit-1a', 150)
    await store.reviewLuasChange(manager, req.id, 'approved')
    expect(due1a.amountIdr).toBe(1_000_000)
    const second = await store.openPeriod(manager, '2026-09')
    const next = second.dues.find((d) => d.unitId === 'unit-1a')!
    expect(next.luasSnapshotM2).toBe(150)
    expect(next.amountIdr).toBe(1_500_000)
  })

  it('rejects bad mime and expense outside month', async () => {
    const { period, dues } = await store.openPeriod(manager, '2026-08')
    const due1a = dues.find((d) => d.unitId === 'unit-1a')!
    await expect(
      store.uploadProof(resident, due1a.id, {
        bytes: new Uint8Array([1]),
        mimeType: 'application/pdf',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      store.addExpense(manager, {
        periodId: period.id,
        category: 'X',
        amountIdr: 10,
        expenseDate: '2026-07-01',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})
