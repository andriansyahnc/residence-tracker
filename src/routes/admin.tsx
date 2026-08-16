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
type Role = (typeof ROLES)[number]
type Overview = Awaited<ReturnType<typeof getAdminOverview>>

/** The pretend residence that collects users belonging to none — a superadmin. */
const NO_RESIDENCE = '__none__'

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
  const [openId, setOpenId] = useState<string | null>(null)
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

  const groups = groupUsersByResidence(overview)
  const open = groups.find((g) => g.residenceId === openId)

  return (
    <AppShell
      title="Admin"
      subtitle={open ? open.residenceName : 'Semua perumahan'}
      role="superadmin"
      action={
        open ? (
          <button
            type="button"
            className="auralis-btn-ghost text-sm"
            onClick={() => setOpenId(null)}
          >
            Kembali
          </button>
        ) : null
      }
    >
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      {open ? (
        <ResidenceUsers group={open} run={run} />
      ) : (
        <ResidenceList groups={groups} onOpen={setOpenId} run={run} />
      )}
    </AppShell>
  )
}

/** First screen: the residences, plus the box to add one. */
function ResidenceList({
  groups,
  onOpen,
  run,
}: {
  groups: ReturnType<typeof groupUsersByResidence>
  onOpen: (id: string) => void
  run: (action: () => Promise<unknown>) => Promise<void>
}) {
  const addResidence = useServerFn(createResidence)
  const [name, setName] = useState('')

  return (
    <div className="space-y-4">
      <ul className="m-0 list-none space-y-2 p-0">
        {groups.map((g) => (
          <li key={g.residenceId}>
            <button
              type="button"
              className="w-full rounded-lg border border-[var(--border)] p-3 text-left text-sm"
              onClick={() => onOpen(g.residenceId)}
            >
              <span className="font-medium">{g.residenceName}</span>
              <span className="ml-2 text-[var(--text-secondary)]">
                {g.members.length} user
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-end gap-2 border-t pt-4">
        <div className="flex-1">
          <TextField
            label="Nama perumahan baru"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <PrimaryButton
          type="button"
          onClick={() => run(() => addResidence({ data: { name } }))}
        >
          Tambah
        </PrimaryButton>
      </div>
    </div>
  )
}

/** Second screen: the users of one residence, plus the box to add one. */
function ResidenceUsers({
  group,
  run,
}: {
  group: ReturnType<typeof groupUsersByResidence>[number]
  run: (action: () => Promise<unknown>) => Promise<void>
}) {
  const addUser = useServerFn(createUser)
  const changeRole = useServerFn(setMembershipRole)
  const impersonate = useServerFn(startImpersonation)

  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<Role>('resident')

  const isRealResidence = group.residenceId !== NO_RESIDENCE

  return (
    <div className="space-y-4">
      {group.members.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">Belum ada user.</p>
      ) : null}

      {group.members.map(({ user, role: memberRole }) => (
        <div
          key={user.userId}
          className="rounded-lg border border-[var(--border)] p-3 text-sm"
        >
          <div className="font-medium">{user.displayName}</div>
          <div className="text-[var(--text-secondary)]">{user.email}</div>
          {user.platformRole ? (
            <span className="auralis-chip auralis-chip-role mt-1">
              {user.platformRole}
            </span>
          ) : null}
          {memberRole ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="flex-1">Peran</span>
              <select
                className="auralis-input !w-auto"
                defaultValue={memberRole}
                onChange={(e) =>
                  run(() =>
                    changeRole({
                      data: {
                        userId: user.userId,
                        residenceId: group.residenceId,
                        role: e.target.value as Role,
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

      {isRealResidence ? (
        <div className="space-y-2 border-t pt-4">
          <h2 className="text-sm font-medium">Tambah user ke {group.residenceName}</h2>
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
            <span className="auralis-label">Peran</span>
            <select
              className="auralis-input"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
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
                addUser({
                  data: {
                    email,
                    displayName,
                    residenceId: group.residenceId,
                    role,
                  },
                }),
              )
            }
          >
            Tambah user
          </PrimaryButton>
        </div>
      ) : null}

      {/* Kept so the residence id is easy to copy into a CSV import. */}
      {isRealResidence ? (
        <p className="text-sm text-[var(--text-secondary)]">
          residence_id: {group.residenceId}
        </p>
      ) : null}
    </div>
  )
}

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
        role: user.memberships.find((m) => m.residenceId === residence.id)!
          .role as Role | null,
      })),
  }))

  const orphans = overview.users.filter((u) => u.memberships.length === 0)
  if (orphans.length > 0) {
    groups.push({
      residenceId: NO_RESIDENCE,
      residenceName: 'Tanpa perumahan',
      members: orphans.map((user) => ({ user, role: null })),
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
