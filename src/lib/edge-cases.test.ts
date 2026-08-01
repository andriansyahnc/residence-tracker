import { describe, expect, it, beforeEach } from 'vitest'
import { AppError } from '../domain/errors'
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

describe('RFC edge cases', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore(createTestDb())
  })

  it('returns 409 conflict when expected status is stale', () => {
    const problem = store.createProblem(resident, {
      title: 'Heat',
      description: 'No heat',
    })
    store.updateProblemStatus(manager, problem.id, 'acknowledged', 'submitted')
    expect(() =>
      store.updateProblemStatus(manager, problem.id, 'rejected', 'submitted'),
    ).toThrow(AppError)
    try {
      store.updateProblemStatus(manager, problem.id, 'rejected', 'submitted')
    } catch (err) {
      expect(err).toMatchObject({ code: 'CONFLICT' })
    }
  })

  it('sorts list by created_at descending', () => {
    const first = store.createProblem(resident, {
      title: 'First',
      description: 'older',
    })
    const second = store.createProblem(resident, {
      title: 'Second',
      description: 'newer',
    })
    const list = store.listProblems(resident)
    expect(list[0].id).toBe(second.id)
    expect(list[1].id).toBe(first.id)
  })

  it('finds profile without membership for E1', () => {
    const auth = store.findAuthUserByEmail('nomember@example.com')
    expect(auth).toMatchObject({ kind: 'no-membership' })
  })
})
