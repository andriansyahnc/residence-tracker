import { createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { getAuthState, logout } from '../server/auth.functions'

export const Route = createFileRoute('/not-a-member')({
  beforeLoad: async () => {
    const auth = await getAuthState()
    if (!auth) {
      throw redirect({ to: '/login' })
    }
    if (auth.kind === 'member') {
      throw redirect({ to: '/problems' })
    }
    return { auth }
  },
  component: NotAMemberPage,
})

function NotAMemberPage() {
  const { auth } = Route.useRouteContext()
  const logoutFn = useServerFn(logout)

  return (
    <main className="auralis-bg mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg flex-col justify-center px-4 py-12">
      <section className="auralis-card rise-in p-8 text-center">
        <p className="auralis-label mb-2">Access</p>
        <h1 className="mb-3 text-2xl font-medium text-[var(--text-primary)]">
          No residence membership
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-[var(--text-secondary)]">
          Signed in as{' '}
          <span className="font-medium text-[var(--text-primary)]">
            {auth.displayName}
          </span>{' '}
          ({auth.email}), but this account is not linked to a residence yet.
          Contact your building manager to get access.
        </p>
        <button
          type="button"
          className="auralis-btn-secondary w-full"
          onClick={async () => {
            await logoutFn()
            window.location.href = '/login'
          }}
        >
          Sign out
        </button>
      </section>
    </main>
  )
}
