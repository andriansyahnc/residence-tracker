import { and, desc, eq, sql } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type {
  AuthLookup,
  Comment,
  Problem,
  ProblemStatus,
  SessionUser,
} from '../domain/types'
import { AppError } from '../domain/errors'
import { canCommentOnProblem, canViewProblem } from '../domain/permissions'
import { canTransitionStatus } from '../domain/status'
import { validateComment, validateProblemInput } from '../domain/validation'
import type { ProblemInput } from '../domain/validation'
import { createTestDb, getDb } from '../db'
import * as schema from '../db/schema'
import { comments, memberships, problems, profiles, residences } from '../db/schema'

export type ProblemDetail = Problem & {
  comments: Comment[]
  reporterName: string
}

type Db = BetterSQLite3Database<typeof schema>

function membershipFor(user: SessionUser) {
  return {
    userId: user.userId,
    residenceId: user.residenceId,
    role: user.role,
  }
}

function nowIso() {
  return new Date().toISOString()
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function mapProblem(row: typeof problems.$inferSelect): Problem {
  return {
    id: row.id,
    residenceId: row.residenceId,
    reporterUserId: row.reporterUserId,
    title: row.title,
    description: row.description,
    unit: row.unit ?? undefined,
    category: row.category ?? undefined,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    statusChangedAt: row.statusChangedAt,
  }
}

function mapComment(row: typeof comments.$inferSelect): Comment {
  return {
    id: row.id,
    problemId: row.problemId,
    residenceId: row.residenceId,
    authorUserId: row.authorUserId,
    body: row.body,
    createdAt: row.createdAt,
  }
}

export function createStore(db: Db = getDb()) {
  function profileName(userId: string) {
    const profile = db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .get()
    return profile?.displayName ?? 'Unknown user'
  }

  function getProblemRecord(problemId: string) {
    const row = db
      .select()
      .from(problems)
      .where(eq(problems.id, problemId))
      .get()
    return row ? mapProblem(row) : null
  }

  function toDetail(user: SessionUser, problem: Problem): ProblemDetail {
    const rows = db
      .select()
      .from(comments)
      .where(eq(comments.problemId, problem.id))
      .orderBy(comments.createdAt)
      .all()

    return {
      ...problem,
      reporterName: profileName(problem.reporterUserId),
      comments: rows.map(mapComment),
    }
  }

  return {
    findAuthUserByEmail(email: string): AuthLookup | null {
      const profile = db
        .select()
        .from(profiles)
        .where(eq(profiles.email, email.toLowerCase()))
        .get()
      if (!profile) return null

      const membership = db
        .select()
        .from(memberships)
        .where(eq(memberships.userId, profile.id))
        .get()
      if (!membership) {
        return {
          kind: 'no-membership',
          userId: profile.id,
          email: profile.email,
          displayName: profile.displayName,
        }
      }

      const residence = db
        .select()
        .from(residences)
        .where(eq(residences.id, membership.residenceId))
        .get()
      if (!residence) return null

      return {
        kind: 'member',
        user: {
          userId: profile.id,
          email: profile.email,
          displayName: profile.displayName,
          residenceId: residence.id,
          residenceName: residence.name,
          role: membership.role,
        },
      }
    },

    findUserByEmail(email: string): SessionUser | null {
      const auth = this.findAuthUserByEmail(email)
      return auth?.kind === 'member' ? auth.user : null
    },

    listProblems(user: SessionUser, statusFilter?: ProblemStatus): Problem[] {
      const filters = [eq(problems.residenceId, user.residenceId)]
      if (user.role === 'resident') {
        filters.push(eq(problems.reporterUserId, user.userId))
      }
      if (statusFilter) {
        filters.push(eq(problems.status, statusFilter))
      }

      return db
        .select()
        .from(problems)
        .where(and(...filters))
        .orderBy(desc(problems.createdAt), desc(sql`rowid`))
        .all()
        .map(mapProblem)
    },

    getProblem(user: SessionUser, problemId: string): ProblemDetail | null {
      const problem = getProblemRecord(problemId)
      if (!problem) return null
      if (!canViewProblem(membershipFor(user), problem)) return null
      return toDetail(user, problem)
    },

    createProblem(user: SessionUser, input: ProblemInput): Problem {
      const validated = validateProblemInput(input)
      if (!validated.ok) {
        throw new Error(validated.error)
      }

      const timestamp = nowIso()
      const row = {
        id: id('problem'),
        residenceId: user.residenceId,
        reporterUserId: user.userId,
        title: validated.value.title,
        description: validated.value.description,
        unit: validated.value.unit ?? null,
        category: validated.value.category ?? null,
        status: 'submitted' as const,
        createdAt: timestamp,
        updatedAt: timestamp,
        statusChangedAt: timestamp,
      }

      db.insert(problems).values(row).run()
      return mapProblem(row)
    },

    updateProblemStatus(
      user: SessionUser,
      problemId: string,
      nextStatus: ProblemStatus,
      expectedStatus: ProblemStatus,
      comment?: string,
    ): Problem {
      if (user.role !== 'manager') {
        throw new Error('Forbidden')
      }

      const problem = getProblemRecord(problemId)
      if (!problem) {
        throw new Error('Not found')
      }
      if (problem.residenceId !== user.residenceId) {
        throw new Error('Not found')
      }
      if (problem.status !== expectedStatus) {
        throw new AppError('CONFLICT', 'Status changed; reload and try again')
      }
      if (!canTransitionStatus(problem.status, nextStatus, user.role)) {
        throw new Error('Invalid status transition')
      }
      if (nextStatus === 'rejected' && !comment?.trim()) {
        throw new Error('A comment is required when rejecting a problem')
      }

      const timestamp = nowIso()
      db.update(problems)
        .set({
          status: nextStatus,
          updatedAt: timestamp,
          statusChangedAt: timestamp,
        })
        .where(eq(problems.id, problemId))
        .run()

      if (nextStatus === 'rejected' && comment?.trim()) {
        db.insert(comments)
          .values({
            id: id('comment'),
            problemId: problem.id,
            residenceId: problem.residenceId,
            authorUserId: user.userId,
            body: comment.trim(),
            createdAt: timestamp,
          })
          .run()
      }

      return getProblemRecord(problemId)!
    },

    addComment(user: SessionUser, problemId: string, body: string): Comment {
      const validated = validateComment(body)
      if (!validated.ok) {
        throw new Error(validated.error)
      }

      const problem = getProblemRecord(problemId)
      if (!problem) {
        throw new Error('Not found')
      }
      if (!canCommentOnProblem(membershipFor(user), problem)) {
        throw new Error('Cannot comment on this problem')
      }

      const timestamp = nowIso()
      const row = {
        id: id('comment'),
        problemId,
        residenceId: problem.residenceId,
        authorUserId: user.userId,
        body: validated.value,
        createdAt: timestamp,
      }
      db.insert(comments).values(row).run()
      db.update(problems)
        .set({ updatedAt: timestamp })
        .where(eq(problems.id, problemId))
        .run()

      return mapComment(row)
    },
  }
}

let singleton = createStore()

export function getStore() {
  return singleton
}

export function resetStore() {
  singleton = createStore(createTestDb())
}
