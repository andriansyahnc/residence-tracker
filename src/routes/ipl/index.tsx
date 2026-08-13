import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { IplNavTabs } from '../../components/ipl-nav'
import { AppShell } from '../../components/ui'
import { getAuthState } from '../../server/auth.functions'
import { listMyIplDues, uploadIplProof } from '../../server/ipl.functions'

export const Route = createFileRoute('/ipl/')({
  beforeLoad: async () => {
    const auth = await getAuthState()
    if (!auth) throw redirect({ to: '/login' })
    if (auth.kind === 'no-membership') throw redirect({ to: '/not-a-member' })
    return { user: auth.user }
  },
  loader: async ({ context }) => {
    const dues = await listMyIplDues({ data: {} })
    return { dues, user: context.user }
  },
  component: IplPage,
})

function IplPage() {
  const { dues, user } = Route.useLoaderData()
  const upload = useServerFn(uploadIplProof)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <AppShell title="IPL" subtitle="Tagihan unit Anda" role={user.role}>
      <IplNavTabs user={user} active="ipl" />
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {dues.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Belum ada tagihan IPL untuk periode ini.
        </p>
      ) : (
        <ul className="space-y-3">
          {dues.map((due) => (
            <li
              key={due.id}
              className="rounded-lg border border-[var(--border)] p-3"
            >
              <div className="font-medium">
                {due.yearMonth} · Rp {due.amountIdr.toLocaleString('id-ID')}
              </div>
              <label className="mt-2 block text-sm">
                Unggah bukti transfer
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-1 block w-full text-sm"
                  disabled={busy === due.id}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setBusy(due.id)
                    setError(null)
                    try {
                      const buf = new Uint8Array(await file.arrayBuffer())
                      let binary = ''
                      buf.forEach((b) => {
                        binary += String.fromCharCode(b)
                      })
                      await upload({
                        data: {
                          dueId: due.id,
                          base64: btoa(binary),
                          mimeType: file.type,
                        },
                      })
                      window.location.reload()
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Gagal unggah')
                    } finally {
                      setBusy(null)
                    }
                  }}
                />
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <Link to="/ipl/laporan" className="auralis-btn-primary inline-block">
          Lihat laporan
        </Link>
      </div>
    </AppShell>
  )
}
