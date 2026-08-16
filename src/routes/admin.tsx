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

      <section className="space-y-5">
        <h2 className="text-sm font-medium">User per perumahan</h2>
        {groupUsersByResidence(overview).map((group) => (
          <div key={group.residenceId} className="space-y-2">
            <h3 className="text-sm text-[var(--text-secondary)]">
              {group.residenceName} ({group.members.length})
            </h3>
            {group.members.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Belum ada user.
              </p>
            ) : null}
            {group.members.map(({ user, role }) => (
              <div
                key={`${group.residenceId}-${user.userId}`}
                className="rounded-lg border border-[var(--border)] p-3 text-sm"
              >
                <div className="font-medium">{user.displayName}</div>
                <div className="text-[var(--text-secondary)]">{user.email}</div>
                {user.platformRole ? (
                  <span className="auralis-chip auralis-chip-role mt-1">
                    {user.platformRole}
                  </span>
                ) : null}
                {role ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="flex-1">Peran</span>
                    <select
                      className="auralis-input !w-auto"
                      defaultValue={role}
                      onChange={(e) =>
                        run(() =>
                          changeRole({
                            data: {
                              userId: user.userId,
                              residenceId: group.residenceId,
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
                ) : null}
                {canImpersonate(user) ? (
                  <button
                    type="button"
                    className="auralis-btn-ghost mt-2 text-sm"
                    onClick={() =>
                      run(async () => {
                        await impersonate({ data: { targetUserId: user.userId } })
                        window.location.href = '/problems'
                      })
                    }
                  >
                    Masuk sebagai user ini
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </section>
    </AppShell>
  )
}

type Overview = Awaited<ReturnType<typeof getAdminOverview>>

/**
 * One block per residence. A user in two residences shows up in both, with the
 * role they hold there. Users in none — a superadmin — go in the last block.
 */
function groupUsersByResidence(overview: Overview) {
  const groups = overview.residences.map((residence) => ({
    residenceId: residence.id,
    residenceName: residence.name,
    members: overview.users
      .filter((u) => u.memberships.some((m) => m.residenceId === residence.id))
      .map((user) => ({
        user,
        role: user.memberships.find((m) => m.residenceId === residence.id)!.role,
      })),
  }))

  const orphans = overview.users.filter((u) => u.memberships.length === 0)
  if (orphans.length > 0) {
    groups.push({
      residenceId: '__none__',
      residenceName: 'Tanpa perumahan',
      members: orphans.map((user) => ({ user, role: null as never })),
    })
  }
  return groups
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
