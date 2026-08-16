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
  listIplPeriods,
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
      typeof search.yearMonth === 'string' ? search.yearMonth : undefined,
  }),
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps }) => {
    const periods = await listIplPeriods()
    // No month in the URL means the newest one the group has.
    const yearMonth = deps.search.yearMonth ?? periods[0]?.yearMonth
    let report = null
    if (yearMonth) {
      try {
        report = await getIplReport({ data: { yearMonth } })
      } catch {
        report = null
      }
    }
    return { report, periods, user: context.user, yearMonth }
  },
  component: LaporanPage,
})

function LaporanPage() {
  const { report, periods, user, yearMonth } = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const staff = canIplStaff({
    userId: user.userId,
    residenceId: user.residenceId,
    role: user.role,
  })
  const saveKet = useServerFn(upsertIplKeterangan)
  const downloadPdf = useServerFn(downloadIplReportPdf)
  const [ket, setKet] = useState(report?.keterangan ?? '')

  return (
    <AppShell
      title="Laporan"
      subtitle={yearMonth ? `Gabungan ${yearMonth}` : 'Gabungan'}
      role={user.role}
    >
      <IplNavTabs user={user} active="laporan" />
      {periods.length > 0 ? (
        <label className="mb-4 block space-y-2">
          <span className="auralis-label">Bulan</span>
          <select
            className="auralis-input"
            value={yearMonth ?? ''}
            onChange={(e) =>
              navigate({ search: { yearMonth: e.target.value } })
            }
          >
            {periods.map((p) => (
              <option key={p.yearMonth} value={p.yearMonth}>
                {p.yearMonth}
                {p.status === 'open' ? ' (buka)' : ''}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {!report ? (
        <p className="text-sm text-[var(--text-secondary)]">
          {yearMonth
            ? `Laporan ${yearMonth} belum tersedia.`
            : 'Belum ada periode IPL.'}
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
                  const file = await downloadPdf({
                    data: { yearMonth: report.yearMonth },
                  })
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
