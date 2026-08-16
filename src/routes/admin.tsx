import { createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { AppShell, PrimaryButton, TextField } from '../components/ui'
import {
  createResidence,
  createUser,
  getAdminContext,
  getAdminOverview,
  setMembershipRole,
  startImpersonation,
} from '../server/admin.functions'

const ROLES = ['resident', 'manager', 'accountant'] as const

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const context = await getAdminContext()
    if (!context) throw redirect({ to: '/login' })
    if (context.platformRole !== 'superadmin') {
      throw redirect({ to: '/problems', search: { status: 'all' } })
    }
  },
  loader: async () => ({ overview: await getAdminOverview() }),
  component: AdminPage,
})

function AdminPage() {
  const { overview } = Route.useLoaderData()
  const addResidence = useServerFn(createResidence)
  const addUser = useServerFn(createUser)
  const changeRole = useServerFn(setMembershipRole)
  const impersonate = useServerFn(startImpersonation)

  const [residenceName, setResidenceName] = useState('')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [residenceId, setResidenceId] = useState(overview.residences[0]?.id ?? '')
  const [role, setRole] = useState<(typeof ROLES)[number]>('resident')
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal')
    }
  }

  return (
    <AppShell title="Admin" subtitle="Semua perumahan" role="superadmin">
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <section className="mb-6 space-y-2">
        <h2 className="text-sm font-medium">Perumahan</h2>
        <ul className="space-y-1 text-sm">
          {overview.residences.map((r) => (
            <li key={r.id}>
              {r.name} · <span className="text-[var(--text-secondary)]">{r.id}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TextField
              label="Nama perumahan baru"
              value={residenceName}
              onChange={(e) => setResidenceName(e.target.value)}
            />
          </div>
          <PrimaryButton
            type="button"
            onClick={() => run(() => addResidence({ data: { name: residenceName } }))}
          >
            Tambah
          </PrimaryButton>
        </div>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="text-sm font-medium">Tambah user</h2>
        <TextField
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Nama"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <label className="block space-y-2">
          <span className="auralis-label">Perumahan</span>
          <select
            className="auralis-input"
            value={residenceId}
            onChange={(e) => setResidenceId(e.target.value)}
          >
            {overview.residences.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="auralis-label">Peran</span>
          <select
            className="auralis-input"
            value={role}
            onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <PrimaryButton
          type="button"
          onClick={() =>
            run(() =>
              addUser({ data: { email, displayName, residenceId, role } }),
            )
          }
        >
          Tambah user
        </PrimaryButton>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">User</h2>
        {overview.users.map((u) => (
          <div
            key={u.userId}
            className="rounded-lg border border-[var(--border)] p-3 text-sm"
          >
            <div className="font-medium">{u.displayName}</div>
            <div className="text-[var(--text-secondary)]">{u.email}</div>
            {u.platformRole ? (
              <span className="auralis-chip auralis-chip-role mt-1">
                {u.platformRole}
              </span>
            ) : null}
            {u.memberships.map((m) => (
              <div key={m.residenceId} className="mt-2 flex items-center gap-2">
                <span className="flex-1">{m.residenceName}</span>
                <select
                  className="auralis-input !w-auto"
                  defaultValue={m.role}
                  onChange={(e) =>
                    run(() =>
                      changeRole({
                        data: {
                          userId: u.userId,
                          residenceId: m.residenceId,
                          role: e.target.value as (typeof ROLES)[number],
                        },
                      }),
                    )
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {canImpersonate(u) ? (
              <button
                type="button"
                className="auralis-btn-ghost mt-2 text-sm"
                onClick={() =>
                  run(async () => {
                    await impersonate({ data: { targetUserId: u.userId } })
                    window.location.href = '/problems'
                  })
                }
              >
                Masuk sebagai user ini
              </button>
            ) : null}
          </div>
        ))}
      </section>
    </AppShell>
  )
}

/** Mirrors the server rule: admins, managers and accountants only. */
function canImpersonate(user: {
  platformRole: string | null
  memberships: { role: string }[]
}) {
  if (user.platformRole === 'superadmin') return false
  if (user.platformRole === 'admin') return true
  return user.memberships.some(
    (m) => m.role === 'manager' || m.role === 'accountant',
  )
}
