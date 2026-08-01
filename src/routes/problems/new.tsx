import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { AppShell, PrimaryButton, TextArea, TextField } from '../../components/ui'
import { getAuthState } from '../../server/auth.functions'
import { createProblem } from '../../server/problems.functions'
import type { ProblemCategory } from '../../domain/types'

export const Route = createFileRoute('/problems/new')({
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
  component: NewProblemPage,
})

const CATEGORIES: ProblemCategory[] = [
  'maintenance',
  'facilities',
  'safety',
  'noise',
  'other',
]

function NewProblemPage() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const createFn = useServerFn(createProblem)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState('')
  const [category, setCategory] = useState<ProblemCategory | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  return (
    <AppShell title="New problem" subtitle={user.residenceName} role={user.role}>
      <form
        className="space-y-4 pb-24"
        onSubmit={async (e) => {
          e.preventDefault()
          setLoading(true)
          setError(null)
          try {
            const problem = await createFn({
              data: {
                title,
                description,
                ...(unit.trim() ? { unit: unit.trim() } : {}),
                ...(category ? { category } : {}),
              },
            })
            await router.navigate({
              to: '/problems/$problemId',
              params: { problemId: problem.id },
            })
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not create problem')
          } finally {
            setLoading(false)
          }
        }}
      >
        <TextField
          label="Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief summary"
        />
        <TextArea
          label="Description"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened? Where?"
        />
        <TextField
          label="Unit / location (optional)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="e.g. 4B"
        />
        <label className="block space-y-1.5">
          <span className="auralis-label">
            Category (optional)
          </span>
          <select
            className="w-full rounded-xl border border-[rgba(23,58,64,0.15)] bg-white px-4 py-3 text-base"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as ProblemCategory | '')
            }
          >
            <option value="">Select…</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Submitting…' : 'Submit problem'}
        </PrimaryButton>
      </form>
    </AppShell>
  )
}
