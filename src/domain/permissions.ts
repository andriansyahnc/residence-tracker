import type { Membership, Problem } from './types'

export function canCreateProblem(_membership: Membership): boolean {
  return true
}

export function canIplStaff(membership: Membership): boolean {
  return membership.role === 'manager' || membership.role === 'accountant'
}

export function canManageProblems(membership: Membership): boolean {
  return membership.role === 'manager'
}

export function canManageQueue(membership: Membership): boolean {
  return membership.role === 'manager'
}

export function canViewProblem(membership: Membership, problem: Problem): boolean {
  if (membership.residenceId !== problem.residenceId) return false
  if (membership.role === 'manager') return true
  return problem.reporterUserId === membership.userId
}

export function canCommentOnProblem(
  membership: Membership,
  problem: Problem,
): boolean {
  if (!canViewProblem(membership, problem)) return false
  if (membership.role === 'manager') return true
  return problem.status !== 'closed' && problem.status !== 'rejected'
}

export function canUpdateStatus(membership: Membership): boolean {
  return membership.role === 'manager'
}
