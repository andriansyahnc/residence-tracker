export const PROBLEM_STATUSES = [
  'submitted',
  'acknowledged',
  'in_progress',
  'resolved',
  'closed',
  'rejected',
] as const

export type ProblemStatus = (typeof PROBLEM_STATUSES)[number]
export type Role = 'resident' | 'manager'

const MANAGER_TRANSITIONS: Record<ProblemStatus, ProblemStatus[]> = {
  submitted: ['acknowledged', 'in_progress', 'rejected'],
  acknowledged: ['in_progress', 'rejected'],
  in_progress: ['resolved'],
  resolved: ['closed', 'in_progress'],
  closed: ['in_progress'],
  rejected: [],
}

export function getAllowedTransitions(
  current: ProblemStatus,
  role: Role,
): ProblemStatus[] {
  if (role !== 'manager') return []
  return MANAGER_TRANSITIONS[current]
}

export function canTransitionStatus(
  current: ProblemStatus,
  next: ProblemStatus,
  role: Role,
): boolean {
  return getAllowedTransitions(current, role).includes(next)
}
