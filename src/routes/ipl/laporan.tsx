import { createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { IplNavTabs } from '../../components/ipl-nav'
import { AppShell, PrimaryButton, TextField } from '../../components/ui'
import { canIplStaff } from '../../domain/permissions'
import { getAuthState } from '../../server/auth.functions'
import {
  downloadIplReportPdf,
  getIplReport,
  upsertIplKeterangan,
} from '../../server/ipl.functions'

export const Route = createFileRoute('/ipl/laporan')({
  beforeLoad: async () => {
    const auth = await getAuthState()
    if (!auth) throw redirect({ to: '/login' })
    if (auth.kind === 'no-membership') throw redirect({ to: '/not-a-member' })
    return { user: auth.user }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    yearMonth:
      typeof search.yearMonth === 'string' ? search.yearMonth : '2026-08',
  }),
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps }) => {
    let report = null
    try {
      report = await getIplReport({ data: { yearMonth: deps.search.yearMonth } })
    } catch {
      report = null
    }
    return { report, user: context.user, yearMonth: deps.search.yearMonth }
  },
  component: LaporanPage,
})

function LaporanPage() {
  const { report, user, yearMonth } = Route.useLoaderData()
  const staff = canIplStaff({
    userId: user.userId,
    residenceId: user.residenceId,
    role: user.role,
  })
  const saveKet = useServerFn(upsertIplKeterangan)
  const downloadPdf = useServerFn(downloadIplReportPdf)
  const [ket, setKet] = useState(report?.keterangan ?? '')

  return (
    <AppShell title="Laporan" subtitle={`Gabungan ${yearMonth}`} role={user.role}>
      <IplNavTabs user={user} active="laporan" />
      {!report ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Laporan {yearMonth} belum tersedia.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          {report.residences.map((r) => (
            <div key={r.id}>
              Pemasukan IPL {r.name}: Rp {r.incomeIdr.toLocaleString('id-ID')}
            </div>
          ))}
          {report.expenses.map((e) => (
            <div key={e.id}>
              Pengeluaran {e.category}: Rp {e.amountIdr.toLocaleString('id-ID')}
            </div>
          ))}
          <div className="font-medium">
            Saldo total: Rp {report.saldoTotalIdr.toLocaleString('id-ID')}
          </div>
          <div>Keterangan: {report.keterangan || '—'}</div>
          {staff ? (
            <div className="space-y-2 border-t pt-3">
              <TextField
                label="Keterangan (staf)"
                value={ket}
                onChange={(e) => setKet(e.target.value)}
              />
              <PrimaryButton
                type="button"
                onClick={async () => {
                  await saveKet({
                    data: { periodId: report.periodId, keterangan: ket },
                  })
                  window.location.reload()
                }}
              >
                Simpan keterangan
              </PrimaryButton>
              <PrimaryButton
                type="button"
                onClick={async () => {
                  const file = await downloadPdf({ data: { yearMonth } })
                  const bin = atob(file.base64)
                  const bytes = new Uint8Array(bin.length)
                  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
                  const blob = new Blob([bytes], { type: 'application/pdf' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = file.filename
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                Unduh PDF
              </PrimaryButton>
            </div>
          ) : null}
        </div>
      )}
    </AppShell>
  )
}
