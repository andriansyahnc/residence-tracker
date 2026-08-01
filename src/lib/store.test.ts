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

  beforeEach(async () => {
    store = createStore(await createTestDb())
  })

  it('creates a problem for a resident', async () => {
    const problem = await store.createProblem(resident, {
      title: 'Broken elevator',
      description: 'Stuck on floor 3',
    })
    expect(problem.status).toBe('submitted')
    expect(problem.reporterUserId).toBe(resident.userId)
  })

  it('lists only own problems for resident', async () => {
    await store.createProblem(resident, {
      title: 'Noise',
      description: 'Late night party',
    })
    await store.createProblem(manager, {
      title: 'Manager issue',
      description: 'Staff only',
    })
    const list = await store.listProblems(resident)
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('Noise')
  })

  it('lists all problems for manager', async () => {
    await store.createProblem(resident, { title: 'A', description: 'a' })
    await store.createProblem(resident, { title: 'B', description: 'b' })
    expect(await store.listProblems(manager)).toHaveLength(2)
  })

  it('rejects invalid status transition', async () => {
    const problem = await store.createProblem(resident, {
      title: 'Leak',
      description: 'Pipe burst',
    })
    await expect(
      store.updateProblemStatus(manager, problem.id, 'closed', problem.status),
    ).rejects.toThrow(/invalid/i)
  })

  it('requires comment when rejecting', async () => {
    const problem = await store.createProblem(resident, {
      title: 'Duplicate',
      description: 'Already reported',
    })
    await expect(
      store.updateProblemStatus(
        manager,
        problem.id,
        'rejected',
        problem.status,
      ),
    ).rejects.toThrow(/comment/i)
  })

  it('adds comment to problem', async () => {
    const problem = await store.createProblem(resident, {
      title: 'Heat',
      description: 'No heating',
    })
    const comment = await store.addComment(resident, problem.id, 'Still cold')
    expect(comment.body).toBe('Still cold')
    expect((await store.getProblem(resident, problem.id))?.comments).toHaveLength(1)
  })

  it('denies resident access to another residents problem', async () => {
    const problem = await store.createProblem(resident, {
      title: 'Private',
      description: 'Mine only',
    })
    const outsider: SessionUser = {
      ...resident,
      userId: 'user-other',
      email: 'other@example.com',
    }
    expect(await store.getProblem(outsider, problem.id)).toBeNull()
  })
})
