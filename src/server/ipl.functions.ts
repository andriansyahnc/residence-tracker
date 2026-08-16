import { createServerFn } from '@tanstack/react-start'
import { canIplStaff } from '../domain/permissions'
import { getIplStore } from '../lib/ipl-store'
import { renderIplReportPdf } from './ipl-pdf'

export const openIplPeriod = createServerFn({ method: 'POST' })
  .validator((data: { yearMonth: string }) => data)
  .handler(async ({ data }) => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    return getIplStore().openPeriod(user, data.yearMonth)
  })

export const listMyIplDues = createServerFn({ method: 'GET' })
  .validator((data: { yearMonth?: string }) => data)
  .handler(async ({ data }) => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    return getIplStore().listMyDues(user, data.yearMonth)
  })

export const uploadIplProof = createServerFn({ method: 'POST' })
  .validator(
    (data: { dueId: string; base64: string; mimeType: string }) => data,
  )
  .handler(async ({ data }) => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0))
    return getIplStore().uploadProof(user, data.dueId, {
      bytes,
      mimeType: data.mimeType,
    })
  })

export const listPendingIplProofs = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    return getIplStore().listPendingProofs(user)
  },
)

export const importIplHistoryCsv = createServerFn({ method: 'POST' })
  .validator((data: { csv: string }) => data)
  .handler(async ({ data }) => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    return getIplStore().importHistoryCsv(user, data.csv)
  })

export const listIplPeriods = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    return getIplStore().listPeriods(user)
  },
)

export const reviewIplProof = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      proofId: string
      status: 'verified' | 'rejected'
      reviewNote?: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    return getIplStore().reviewProof(user, data.proofId, {
      status: data.status,
      reviewNote: data.reviewNote,
    })
  })

export const addIplExpense = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      periodId: string
      category: string
      amountIdr: number
      expenseDate: string
      note?: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    return getIplStore().addExpense(user, data)
  })

export const getIplReport = createServerFn({ method: 'GET' })
  .validator((data: { yearMonth: string }) => data)
  .handler(async ({ data }) => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    return getIplStore().getMonthlyReport(user, data.yearMonth)
  })

export const upsertIplKeterangan = createServerFn({ method: 'POST' })
  .validator((data: { periodId: string; keterangan: string }) => data)
  .handler(async ({ data }) => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    return getIplStore().upsertKeterangan(
      user,
      data.periodId,
      data.keterangan,
    )
  })

export const downloadIplReportPdf = createServerFn({ method: 'POST' })
  .validator((data: { yearMonth: string }) => data)
  .handler(async ({ data }) => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    if (!canIplStaff({
      userId: user.userId,
      residenceId: user.residenceId,
      role: user.role,
    })) {
      throw new Error('Forbidden')
    }
    const report = await getIplStore().getMonthlyReport(user, data.yearMonth)
    const buffer = await renderIplReportPdf(report)
    return {
      base64: Buffer.from(buffer).toString('base64'),
      filename: `laporan-ipl-${report.yearMonth}.pdf`,
    }
  })

export const importIplUnitsCsv = createServerFn({ method: 'POST' })
  .validator((data: { csv: string }) => data)
  .handler(async ({ data }) => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    return getIplStore().importUnitsCsv(user, data.csv)
  })
