import { and, desc, eq } from 'drizzle-orm'
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
import type { AppDatabase } from '../db'
import { createTestDb, getDb } from '../db'
import * as schema from '../db/schema'
import { comments, memberships, problems, profiles, residences } from '../db/schema'

export type ProblemDetail = Problem & {
  comments: Comment[]
  reporterName: string
}

type Db = AppDatabase

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

export function createStore(db: Db) {
  async function profileName(userId: string) {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)
    return profile?.displayName ?? 'Unknown user'
  }

  async function getProblemRecord(problemId: string) {
    const [row] = await db
      .select()
      .from(problems)
      .where(eq(problems.id, problemId))
      .limit(1)
    return row ? mapProblem(row) : null
  }

  async function toDetail(user: SessionUser, problem: Problem): Promise<ProblemDetail> {
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.problemId, problem.id))
      .orderBy(comments.createdAt)

    return {
      ...problem,
      reporterName: await profileName(problem.reporterUserId),
      comments: rows.map(mapComment),
    }
  }

  return {
    async findAuthUserByEmail(email: string): Promise<AuthLookup | null> {
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.email, email.toLowerCase()))
        .limit(1)
      if (!profile) return null

      const [membership] = await db
        .select()
        .from(memberships)
        .where(eq(memberships.userId, profile.id))
        .limit(1)
      if (!membership) {
        return {
          kind: 'no-membership',
          userId: profile.id,
          email: profile.email,
          displayName: profile.displayName,
        }
      }

      const [residence] = await db
        .select()
        .from(residences)
        .where(eq(residences.id, membership.residenceId))
        .limit(1)
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

    async findUserByEmail(email: string): Promise<SessionUser | null> {
      const auth = await this.findAuthUserByEmail(email)
      return auth?.kind === 'member' ? auth.user : null
    },

    async listProblems(
      user: SessionUser,
      statusFilter?: ProblemStatus,
    ): Promise<Problem[]> {
      const filters = [eq(problems.residenceId, user.residenceId)]
      if (user.role === 'resident') {
        filters.push(eq(problems.reporterUserId, user.userId))
      }
      if (statusFilter) {
        filters.push(eq(problems.status, statusFilter))
      }

      const rows = await db
        .select()
        .from(problems)
        .where(and(...filters))
        .orderBy(desc(problems.createdAt), desc(problems.id))

      return rows.map(mapProblem)
    },

    async getProblem(
      user: SessionUser,
      problemId: string,
    ): Promise<ProblemDetail | null> {
      const problem = await getProblemRecord(problemId)
      if (!problem) return null
      if (!canViewProblem(membershipFor(user), problem)) return null
      return toDetail(user, problem)
    },

    async createProblem(user: SessionUser, input: ProblemInput): Promise<Problem> {
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

      await db.insert(problems).values(row)
      return mapProblem(row)
    },

    async updateProblemStatus(
      user: SessionUser,
      problemId: string,
      nextStatus: ProblemStatus,
      expectedStatus: ProblemStatus,
      comment?: string,
    ): Promise<Problem> {
      if (user.role !== 'manager') {
        throw new Error('Forbidden')
      }

      const problem = await getProblemRecord(problemId)
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
      await db
        .update(problems)
        .set({
          status: nextStatus,
          updatedAt: timestamp,
          statusChangedAt: timestamp,
        })
        .where(eq(problems.id, problemId))

      if (nextStatus === 'rejected' && comment?.trim()) {
        await db.insert(comments).values({
          id: id('comment'),
          problemId: problem.id,
          residenceId: problem.residenceId,
          authorUserId: user.userId,
          body: comment.trim(),
          createdAt: timestamp,
        })
      }

      return (await getProblemRecord(problemId))!
    },

    async addComment(
      user: SessionUser,
      problemId: string,
      body: string,
    ): Promise<Comment> {
      const validated = validateComment(body)
      if (!validated.ok) {
        throw new Error(validated.error)
      }

      const problem = await getProblemRecord(problemId)
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
      await db.insert(comments).values(row)
      await db
        .update(problems)
        .set({ updatedAt: timestamp })
        .where(eq(problems.id, problemId))

      return mapComment(row)
    },
  }
}

let singleton: ReturnType<typeof createStore> | null = null

export function getStore() {
  if (!singleton) {
    singleton = createStore(getDb())
  }
  return singleton
}

export async function resetStore() {
  singleton = createStore(await createTestDb())
}

export async function createTestStore() {
  return createStore(await createTestDb())
}
