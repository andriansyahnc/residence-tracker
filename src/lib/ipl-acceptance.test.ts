import { describe, expect, it } from 'vitest'
import { canIplStaff, canManageQueue } from '../domain/permissions'
import { createTestIplStore } from '../lib/ipl-store'
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

describe('ipl acceptance', () => {
  it('covers MVP gate roles and report math', async () => {
    expect(canIplStaff(accountant)).toBe(true)
    expect(canManageQueue(accountant)).toBe(false)
    const store = await createTestIplStore()
    const { period, dues } = await store.openPeriod(manager, '2026-08')
    const due = dues.find((d) => d.unitId === 'unit-1a')!
    const proof = await store.uploadProof(resident, due.id, {
      bytes: new Uint8Array([9]),
      mimeType: 'image/jpeg',
    })
    await store.reviewProof(accountant, proof.id, { status: 'verified' })
    await store.addExpense(manager, {
      periodId: period.id,
      category: 'Keamanan',
      amountIdr: 50_000,
      expenseDate: '2026-08-10',
    })
    await store.upsertKeterangan(manager, period.id, 'OK')
    const report = await store.getMonthlyReport(resident, '2026-08')
    expect(report.keterangan).toBe('OK')
    expect(report.saldoTotalIdr).toBe(due.amountIdr - 50_000)
  })
})
