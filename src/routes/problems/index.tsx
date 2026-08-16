import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  AppShell,
  EmptyState,
  FILTER_STATUSES,
  PrimaryButton,
  ProblemListItem,
} from '../../components/ui'
import { IplNavTabs } from '../../components/ipl-nav'
import { getAuthState } from '../../server/auth.functions'
import { resetDemo } from '../../server/demo.functions'
import { DEMO_RESIDENCE_ID } from '../../domain/constants'
import { listProblems } from '../../server/problems.functions'
import type { ProblemStatus } from '../../domain/types'

export const Route = createFileRoute('/problems/')({
  validateSearch: (search: Record<string, unknown>) => ({
    status:
      typeof search.status === 'string'
        ? (search.status as ProblemStatus | 'all')
        : 'all',
  }),
  beforeLoad: async () => {
    const auth = await getAuthState()
    if (!auth) {
      throw redirect({ to: '/login' })
    }
    if (auth.kind === 'no-membership') {
      throw redirect({ to: '/not-a-member' })
    }
    return { user: auth.user }
  },
  loader: async ({ context, deps }) => {
    const status = deps.search.status
    const problems = await listProblems({
      data: status === 'all' ? {} : { status },
    })
    return { problems, user: context.user }
  },
  loaderDeps: ({ search }) => ({ search }),
  component: ProblemsPage,
})

function ProblemsPage() {
  const { problems, user } = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const resetDemoFn = useServerFn(resetDemo)
  const [resetting, setResetting] = useState(false)

  const isManager = user.role === 'manager'
  const isDemoManager = isManager && user.residenceId === DEMO_RESIDENCE_ID

  return (
    <AppShell
      title={user.residenceName}
      subtitle={isManager ? 'All problems' : 'My problems'}
      role={user.role}
    >
      <IplNavTabs user={user} active="masalah" />
      {isDemoManager ? (
        <div className="mb-4 rounded-lg border border-[var(--border)] p-3">
          <p className="mb-2 text-sm text-[var(--text-secondary)]">
            Ini data demo. Tombol di bawah mengembalikan semua data demo ke
            kondisi awal.
          </p>
          <button
            type="button"
            className="auralis-btn-ghost text-sm"
            disabled={resetting}
            onClick={async () => {
              setResetting(true)
              try {
                await resetDemoFn()
                await router.invalidate()
              } finally {
                setResetting(false)
              }
            }}
          >
            {resetting ? 'Mengembalikan…' : 'Reset data demo'}
          </button>
        </div>
      ) : null}
      {isManager ? (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {FILTER_STATUSES.map((status) => (
            <Link
              key={status}
              to="/problems"
              search={{ status }}
              className={`auralis-filter ${search.status === status ? 'auralis-filter-active' : ''}`}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ')}
            </Link>
          ))}
        </div>
      ) : null}

      {problems.length === 0 ? (
        <EmptyState
          message={
            isManager && search.status !== 'all'
              ? 'Nothing in this filter'
              : 'No problems yet'
          }
        />
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {problems.map((problem) => (
            <li key={problem.id}>
              <ProblemListItem
                id={problem.id}
                title={problem.title}
                status={problem.status}
                updatedAt={problem.updatedAt}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="auralis-sticky-cta">
        <Link to="/problems/new" className="block no-underline">
          <PrimaryButton className="w-full shadow-lg">New problem</PrimaryButton>
        </Link>
      </div>
    </AppShell>
  )
}
