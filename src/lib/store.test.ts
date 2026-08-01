import { describe, expect, it, beforeEach } from 'vitest'
import { createStore } from './store'
import { createTestDb } from '../db'
import type { SessionUser } from '../domain/types'

const resident: SessionUser = {
  userId: 'user-resident',
  email: 'resident@example.com',
  displayName: 'Alex Resident',
  residenceId: 'res-1',
  residenceName: 'Oak Residence',
  role: 'resident',
}

const manager: SessionUser = {
  userId: 'user-manager',
  email: 'manager@example.com',
  displayName: 'Morgan Manager',
  residenceId: 'res-1',
  residenceName: 'Oak Residence',
  role: 'manager',
}

describe('store', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore(createTestDb())
  })

  it('creates a problem for a resident', () => {
    const problem = store.createProblem(resident, {
      title: 'Broken elevator',
      description: 'Stuck on floor 3',
    })
    expect(problem.status).toBe('submitted')
    expect(problem.reporterUserId).toBe(resident.userId)
  })

  it('lists only own problems for resident', () => {
    store.createProblem(resident, {
      title: 'Noise',
      description: 'Late night party',
    })
    store.createProblem(manager, {
      title: 'Manager issue',
      description: 'Staff only',
    })
    const list = store.listProblems(resident)
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('Noise')
  })

  it('lists all problems for manager', () => {
    store.createProblem(resident, { title: 'A', description: 'a' })
    store.createProblem(resident, { title: 'B', description: 'b' })
    expect(store.listProblems(manager)).toHaveLength(2)
  })

  it('rejects invalid status transition', () => {
    const problem = store.createProblem(resident, {
      title: 'Leak',
      description: 'Pipe burst',
    })
    expect(() =>
      store.updateProblemStatus(manager, problem.id, 'closed', problem.status),
    ).toThrow(/invalid/i)
  })

  it('requires comment when rejecting', () => {
    const problem = store.createProblem(resident, {
      title: 'Duplicate',
      description: 'Already reported',
    })
    expect(() =>
      store.updateProblemStatus(
        manager,
        problem.id,
        'rejected',
        problem.status,
      ),
    ).toThrow(/comment/i)
  })

  it('adds comment to problem', () => {
    const problem = store.createProblem(resident, {
      title: 'Heat',
      description: 'No heating',
    })
    const comment = store.addComment(resident, problem.id, 'Still cold')
    expect(comment.body).toBe('Still cold')
    expect(store.getProblem(resident, problem.id)?.comments).toHaveLength(1)
  })

  it('denies resident access to another residents problem', () => {
    const problem = store.createProblem(resident, {
      title: 'Private',
      description: 'Mine only',
    })
    const outsider: SessionUser = {
      ...resident,
      userId: 'user-other',
      email: 'other@example.com',
    }
    expect(store.getProblem(outsider, problem.id)).toBeNull()
  })
})
