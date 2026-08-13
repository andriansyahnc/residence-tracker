export type Role = 'resident' | 'manager' | 'accountant'

export type ProblemCategory =
  | 'maintenance'
  | 'facilities'
  | 'safety'
  | 'noise'
  | 'other'

export type ProblemStatus =
  | 'submitted'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'rejected'

export type Residence = {
  id: string
  name: string
  createdAt: string
}

export type Profile = {
  id: string
  email: string
  displayName: string
  createdAt: string
}

export type Membership = {
  userId: string
  residenceId: string
  role: Role
}

export type Problem = {
  id: string
  residenceId: string
  reporterUserId: string
  title: string
  description: string
  unit?: string
  category?: ProblemCategory
  status: ProblemStatus
  createdAt: string
  updatedAt: string
  statusChangedAt: string
}

export type Comment = {
  id: string
  problemId: string
  residenceId: string
  authorUserId: string
  body: string
  createdAt: string
}

export type SessionUser = {
  userId: string
  email: string
  displayName: string
  residenceId: string
  residenceName: string
  role: Role
}

export type AuthLookup =
  | { kind: 'member'; user: SessionUser }
  | { kind: 'no-membership'; userId: string; email: string; displayName: string }

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }
