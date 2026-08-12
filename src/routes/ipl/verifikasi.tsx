import { createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { IplNavTabs } from '../../components/ipl-nav'
import { AppShell, PrimaryButton } from '../../components/ui'
import { canIplStaff } from '../../domain/permissions'
import { getAuthState } from '../../server/auth.functions'
import {
  listPendingIplProofs,
  reviewIplProof,
} from '../../server/ipl.functions'

export const Route = createFileRoute('/ipl/verifikasi')({
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
  loader: async ({ context }) => {
    const pending = await listPendingIplProofs()
    return { pending, user: context.user }
  },
  component: VerifikasiPage,
})

function VerifikasiPage() {
  const { pending, user } = Route.useLoaderData()
  const review = useServerFn(reviewIplProof)
  const [note, setNote] = useState('')

  return (
    <AppShell title="Verifikasi" subtitle="Antrian bukti IPL" role={user.role}>
      <IplNavTabs user={user} active="verifikasi" />
      {pending.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">Tidak ada antrian.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((p) => (
            <li key={p.id} className="rounded-lg border border-[var(--border)] p-3">
              <div className="text-sm break-all">{p.blobKey}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <PrimaryButton
                  onClick={async () => {
                    await review({
                      data: { proofId: p.id, status: 'verified' },
                    })
                    window.location.reload()
                  }}
                >
                  Verifikasi
                </PrimaryButton>
                <button
                  type="button"
                  className="auralis-btn-ghost text-sm"
                  onClick={async () => {
                    await review({
                      data: {
                        proofId: p.id,
                        status: 'rejected',
                        reviewNote: note || 'Ditolak',
                      },
                    })
                    window.location.reload()
                  }}
                >
                  Tolak
                </button>
              </div>
              <input
                className="mt-2 w-full rounded border px-2 py-1 text-sm"
                placeholder="Catatan penolakan"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
