import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { getAuthState, getSession, loginWithEmail } from '../server/auth.functions'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const auth = await getAuthState()
    if (auth?.kind === 'member') {
      throw redirect({ to: '/problems' })
    }
    if (auth?.kind === 'no-membership') {
      throw redirect({ to: '/not-a-member' })
    }
  },
  component: LoginPage,
})

const DEMO_USERS = [
  { email: 'resident@example.com', label: 'Sign in as resident (Alex)' },
  { email: 'manager@example.com', label: 'Sign in as manager (Morgan)' },
]

function LoginPage() {
  const router = useRouter()
  const loginFn = useServerFn(loginWithEmail)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(targetEmail: string) {
    setLoading(true)
    setError(null)
    try {
      const result = await loginFn({ data: { email: targetEmail } })
      if (!result.ok) {
        setError(result.error)
        return
      }
      await router.invalidate()
      await router.navigate({ to: result.redirectTo })
    } catch {
      setError('Could not sign in. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auralis-bg min-h-[calc(100vh-4rem)]">
      <div
        className="auralis-login-grid mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-6 px-4 py-8 md:grid-cols-2 md:items-stretch md:py-12"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
      >
        <section className="auralis-hero-panel auralis-surface-panel rise-in flex min-h-[320px] flex-col justify-between p-8 md:p-10">
          <div>
            <p className="auralis-kicker mb-4">Residence Tracker °</p>
            <h1 className="auralis-display m-0 mb-4">
              Report clearly.
              <br />
              Track progress.
              <br />
              Stay informed.
            </h1>
            <p className="m-0 max-w-md text-base leading-relaxed text-gray-300">
              Raise maintenance and facility issues in under a minute. Managers
              see one queue; residents always know the status.
            </p>
          </div>
          <ul className="m-0 mt-8 list-none space-y-3 p-0 text-sm text-gray-400">
            <li>◦ Seamless status updates</li>
            <li>◦ Residence-scoped access</li>
            <li>◦ Mobile-first, production-ready</li>
          </ul>
        </section>

        <section className="auralis-card rise-in flex flex-col justify-center p-6 sm:p-8">
          <p className="auralis-label mb-2">Secure access</p>
          <h2 className="mb-2 text-2xl font-medium text-[var(--text-primary)]">
            Sign in
          </h2>
          <p className="mb-6 text-sm text-[var(--text-secondary)]">
            Email magic-link flow. For local demo, enter an email or pick a
            seeded user below.
          </p>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void handleLogin(email)
            }}
          >
            <label className="block space-y-2">
              <span className="auralis-label">Email address</span>
              <input
                className="auralis-input"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className="auralis-btn-primary w-full"
              disabled={loading || !email.trim()}
            >
              {loading ? 'Signing in…' : 'Send magic link'}
            </button>
          </form>

          <div className="mt-8 space-y-2 border-t border-[var(--border)] pt-6">
            <p className="auralis-label">Quick demo</p>
            {DEMO_USERS.map((demo) => (
              <button
                key={demo.email}
                type="button"
                disabled={loading}
                onClick={() => void handleLogin(demo.email)}
                className="auralis-btn-secondary"
              >
                {demo.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
