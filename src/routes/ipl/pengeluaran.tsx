import { createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { IplNavTabs } from '../../components/ipl-nav'
import { AppShell, PrimaryButton, TextField } from '../../components/ui'
import { canIplStaff } from '../../domain/permissions'
import { getAuthState } from '../../server/auth.functions'
import {
  addIplExpense,
  getIplReport,
  openIplPeriod,
} from '../../server/ipl.functions'

export const Route = createFileRoute('/ipl/pengeluaran')({
  beforeLoad: async () => {
    const auth = await getAuthState()
    if (!auth) throw redirect({ to: '/login' })
    if (auth.kind === 'no-membership') throw redirect({ to: '/not-a-member' })
    if (
      !canIplStaff({
        userId: auth.user.userId,
        residenceId: auth.user.residenceId,
        role: auth.user.role,
      })
    ) {
      throw redirect({ to: '/ipl' })
    }
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
  component: PengeluaranPage,
})

function PengeluaranPage() {
  const { report, user, yearMonth } = Route.useLoaderData()
  const addExpense = useServerFn(addIplExpense)
  const openPeriod = useServerFn(openIplPeriod)
  const [category, setCategory] = useState('Kebersihan')
  const [amount, setAmount] = useState('100000')
  const [date, setDate] = useState(`${yearMonth}-01`)

  return (
    <AppShell title="Pengeluaran" subtitle="Beban bersama" role={user.role}>
      <IplNavTabs user={user} active="pengeluaran" />
      {!report ? (
        <div className="space-y-3">
          <p className="text-sm">Belum ada periode {yearMonth}.</p>
          <PrimaryButton
            type="button"
            onClick={async () => {
              await openPeriod({ data: { yearMonth } })
              window.location.reload()
            }}
          >
            Buka periode {yearMonth}
          </PrimaryButton>
        </div>
      ) : (
        <>
          <ul className="mb-4 space-y-2">
            {report.expenses.map((e) => (
              <li key={e.id} className="text-sm">
                {e.expenseDate} · {e.category} · Rp{' '}
                {e.amountIdr.toLocaleString('id-ID')}
              </li>
            ))}
          </ul>
          <form
            className="space-y-3"
            onSubmit={async (ev) => {
              ev.preventDefault()
              await addExpense({
                data: {
                  periodId: report.periodId,
                  category,
                  amountIdr: Number(amount),
                  expenseDate: date,
                },
              })
              window.location.reload()
            }}
          >
            <TextField
              label="Kategori"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <TextField
              label="Jumlah (IDR)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <TextField
              label="Tanggal"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <PrimaryButton type="submit">Tambah pengeluaran</PrimaryButton>
          </form>
        </>
      )}
    </AppShell>
  )
}
