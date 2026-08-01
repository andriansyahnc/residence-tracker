import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import {
  AppShell,
  PrimaryButton,
  StatusBadge,
  TextArea,
} from '../../components/ui'
import { getAllowedTransitions } from '../../domain/status'
import { getAuthState } from '../../server/auth.functions'
import {
  addComment,
  getProblem,
  updateProblemStatus,
} from '../../server/problems.functions'

export const Route = createFileRoute('/problems/$problemId')({
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
  loader: async ({ params }) => {
    const problem = await getProblem({ data: { problemId: params.problemId } })
    return { problem }
  },
  component: ProblemDetailPage,
})

function ProblemDetailPage() {
  const { problem } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const updateStatusFn = useServerFn(updateProblemStatus)
  const addCommentFn = useServerFn(addComment)

  const [comment, setComment] = useState('')
  const [rejectComment, setRejectComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isManager = user.role === 'manager'
  const transitions = isManager
    ? getAllowedTransitions(problem.status, 'manager')
    : []

  async function refresh() {
    await router.invalidate()
  }

  return (
    <AppShell
      title={problem.title}
      subtitle={user.residenceName}
      role={user.role}
      action={
        <Link to="/problems" className="auralis-btn-ghost no-underline">
          ← Back
        </Link>
      }
    >
      <div className="space-y-4 pb-28">
        <div className="auralis-card space-y-4 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <StatusBadge status={problem.status} />
            <span className="text-xs text-[var(--text-secondary)]">
              {new Date(problem.updatedAt).toLocaleString()}
            </span>
          </div>
          <p className="m-0 whitespace-pre-wrap text-[var(--text-primary)]">
            {problem.description}
          </p>
          <dl className="mt-4 grid gap-1 text-sm text-[var(--text-secondary)]">
            <div>
              <dt className="inline font-medium">Reporter: </dt>
              <dd className="inline">{problem.reporterName}</dd>
            </div>
            {problem.unit ? (
              <div>
                <dt className="inline font-medium">Unit: </dt>
                <dd className="inline">{problem.unit}</dd>
              </div>
            ) : null}
            {problem.category ? (
              <div>
                <dt className="inline font-medium">Category: </dt>
                <dd className="inline capitalize">{problem.category}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {isManager && transitions.length > 0 ? (
          <section className="auralis-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
              Update status
            </h2>
            <div className="flex flex-wrap gap-2">
              {transitions.map((nextStatus) => (
                <PrimaryButton
                  key={nextStatus}
                  type="button"
                  disabled={loading}
                  className="!min-h-9 !px-3 !py-1.5 !text-xs capitalize"
                  onClick={async () => {
                    if (nextStatus === 'rejected' && !rejectComment.trim()) {
                      setError('Add a rejection comment below before rejecting')
                      return
                    }
                    setLoading(true)
                    setError(null)
                    try {
                      await updateStatusFn({
                        data: {
                          problemId: problem.id,
                          nextStatus,
                          expectedStatus: problem.status,
                          ...(nextStatus === 'rejected'
                            ? { comment: rejectComment }
                            : {}),
                        },
                      })
                      setRejectComment('')
                      await refresh()
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : 'Could not update status',
                      )
                    } finally {
                      setLoading(false)
                    }
                  }}
                >
                  → {nextStatus.replace('_', ' ')}
                </PrimaryButton>
              ))}
            </div>
            {transitions.includes('rejected') ? (
              <div className="mt-3">
                <TextArea
                  label="Rejection reason (required if rejecting)"
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Explain why this is rejected"
                />
              </div>
            ) : null}
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
            Comments
          </h2>
          {problem.comments.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No comments yet.</p>
          ) : (
            <ul className="m-0 list-none space-y-3 p-0">
              {problem.comments.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-[rgba(23,58,64,0.08)] bg-white/60 px-4 py-3"
                >
                  <p className="m-0 text-sm text-[var(--text-primary)]">{item.body}</p>
                  <p className="mb-0 mt-1 text-xs text-[var(--text-secondary)]">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(isManager ||
          (problem.status !== 'closed' && problem.status !== 'rejected')) && (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setLoading(true)
              setError(null)
              try {
                await addCommentFn({
                  data: { problemId: problem.id, body: comment },
                })
                setComment('')
                await refresh()
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : 'Could not add comment',
                )
              } finally {
                setLoading(false)
              }
            }}
          >
            <TextArea
              label="Add comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ask a question or share an update"
            />
            <PrimaryButton type="submit" disabled={loading || !comment.trim()}>
              Post comment
            </PrimaryButton>
          </form>
        )}

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </AppShell>
  )
}
