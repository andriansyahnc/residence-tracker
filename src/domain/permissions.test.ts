import { describe, expect, it } from 'vitest'
import {
  canCommentOnProblem,
  canCreateProblem,
  canManageQueue,
  canViewProblem,
} from './permissions'
import type { Membership, Problem } from './types'

const residentMembership: Membership = {
  userId: 'user-resident',
  residenceId: 'res-1',
  role: 'resident',
}

const managerMembership: Membership = {
  userId: 'user-manager',
  residenceId: 'res-1',
  role: 'manager',
}

const ownProblem: Problem = {
  id: 'p1',
  residenceId: 'res-1',
  reporterUserId: 'user-resident',
  title: 'Leak',
  description: 'Kitchen sink',
  status: 'submitted',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  statusChangedAt: '2026-01-01T00:00:00Z',
}

const otherResidentProblem: Problem = {
  ...ownProblem,
  id: 'p2',
  reporterUserId: 'user-other',
}

describe('permissions', () => {
  it('allows resident and manager to create problems', () => {
    expect(canCreateProblem(residentMembership)).toBe(true)
    expect(canCreateProblem(managerMembership)).toBe(true)
  })

  it('allows manager to manage queue', () => {
    expect(canManageQueue(residentMembership)).toBe(false)
    expect(canManageQueue(managerMembership)).toBe(true)
  })

  it('allows resident to view own problems only', () => {
    expect(canViewProblem(residentMembership, ownProblem)).toBe(true)
    expect(canViewProblem(residentMembership, otherResidentProblem)).toBe(
      false,
    )
  })

  it('allows manager to view any problem in residence', () => {
    expect(canViewProblem(managerMembership, otherResidentProblem)).toBe(true)
  })

  it('blocks cross-residence access', () => {
    const otherResidence = { ...ownProblem, residenceId: 'res-2' }
    expect(canViewProblem(residentMembership, otherResidence)).toBe(false)
  })

  it('allows resident to comment on own open problems', () => {
    expect(canCommentOnProblem(residentMembership, ownProblem)).toBe(true)
  })

  it('blocks resident comments on closed or rejected', () => {
    expect(
      canCommentOnProblem(residentMembership, {
        ...ownProblem,
        status: 'closed',
      }),
    ).toBe(false)
    expect(
      canCommentOnProblem(residentMembership, {
        ...ownProblem,
        status: 'rejected',
      }),
    ).toBe(false)
  })

  it('allows manager to comment on closed problems', () => {
    expect(
      canCommentOnProblem(managerMembership, {
        ...ownProblem,
        status: 'closed',
      }),
    ).toBe(true)
  })
})
