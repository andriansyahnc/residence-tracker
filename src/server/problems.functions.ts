import { createServerFn } from '@tanstack/react-start'
import type { ProblemStatus } from '../domain/types'
import type { ProblemInput } from '../domain/validation'
import { getStore } from '../lib/store'

export const listProblems = createServerFn({ method: 'GET' })
  .validator((data: { status?: ProblemStatus }) => data)
  .handler(async ({ data }) => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    return getStore().listProblems(user, data.status)
  })

export const getProblem = createServerFn({ method: 'GET' })
  .validator((data: { problemId: string }) => data)
  .handler(async ({ data }) => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    const problem = getStore().getProblem(user, data.problemId)
    if (!problem) {
      throw new Error('Not found')
    }
    return problem
  })

export const createProblem = createServerFn({ method: 'POST' })
  .validator((data: ProblemInput) => data)
  .handler(async ({ data }) => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    return getStore().createProblem(user, data)
  })

export const updateProblemStatus = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      problemId: string
      nextStatus: ProblemStatus
      expectedStatus: ProblemStatus
      comment?: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    return getStore().updateProblemStatus(
      user,
      data.problemId,
      data.nextStatus,
      data.expectedStatus,
      data.comment,
    )
  })

export const addComment = createServerFn({ method: 'POST' })
  .validator((data: { problemId: string; body: string }) => data)
  .handler(async ({ data }) => {
    const { requireSessionUser } = await import('./auth.server')
    const user = await requireSessionUser()
    getStore().addComment(user, data.problemId, data.body)
    return getStore().getProblem(user, data.problemId)
  })
