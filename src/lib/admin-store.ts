import { and, eq, isNull } from 'drizzle-orm'
import { AppError } from '../domain/errors'
import type { AppDatabase } from '../db'
import { getDb } from '../db'
import {
  impersonationLog,
  managementGroupResidences,
  managementGroups,
  memberships,
  platformRoles,
  profiles,
  residences,
} from '../db/schema'

export type PlatformRole = 'superadmin' | 'admin'

/** Roles a superadmin is allowed to borrow. Plain residents are off limits. */
const IMPERSONATABLE_RESIDENCE_ROLES = ['manager', 'accountant'] as const

function nowIso() {
  return new Date().toISOString()
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function createAdminStore(db: AppDatabase) {
  async function platformRoleOf(userId: string): Promise<PlatformRole | null> {
    const [row] = await db
      .select()
      .from(platformRoles)
      .where(eq(platformRoles.userId, userId))
      .limit(1)
    return row?.role ?? null
  }

  async function requireSuperadmin(userId: string) {
    if ((await platformRoleOf(userId)) !== 'superadmin') {
      throw new AppError('FORBIDDEN', 'Superadmin only')
    }
  }

  return {
    platformRoleOf,

    async displayNameOf(userId: string) {
      const [row] = await db
        .select({ displayName: profiles.displayName })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1)
      return row?.displayName ?? null
    },

    /** Everything the admin page shows: residences and who is in them. */
    async listOverview(actorUserId: string) {
      await requireSuperadmin(actorUserId)

      const residenceRows = await db.select().from(residences)
      const profileRows = await db.select().from(profiles)
      const membershipRows = await db.select().from(memberships)
      const platformRows = await db.select().from(platformRoles)

      const platformByUser = new Map(platformRows.map((p) => [p.userId, p.role]))
      const residenceNameById = new Map(residenceRows.map((r) => [r.id, r.name]))

      const users = profileRows.map((p) => ({
        userId: p.id,
        email: p.email,
        displayName: p.displayName,
        platformRole: platformByUser.get(p.id) ?? null,
        memberships: membershipRows
          .filter((m) => m.userId === p.id)
          .map((m) => ({
            residenceId: m.residenceId,
            residenceName: residenceNameById.get(m.residenceId) ?? m.residenceId,
            role: m.role,
          })),
      }))

      return {
        residences: residenceRows.map((r) => ({ id: r.id, name: r.name })),
        users: users.sort((a, b) => a.email.localeCompare(b.email)),
      }
    },

    /** A new residence gets its own management group, so its reports stay its own. */
    async createResidence(actorUserId: string, name: string) {
      await requireSuperadmin(actorUserId)
      const trimmed = name.trim()
      if (!trimmed) throw new AppError('VALIDATION', 'Nama wajib diisi')

      const createdAt = nowIso()
      const residenceId = id('res')
      const groupId = id('mg')

      await db.insert(residences).values({ id: residenceId, name: trimmed, createdAt })
      await db
        .insert(managementGroups)
        .values({ id: groupId, name: `Pengurus ${trimmed}`, createdAt })
      await db.insert(managementGroupResidences).values({
        managementGroupId: groupId,
        residenceId,
        sortOrder: 1,
        createdAt,
      })
      return { id: residenceId, name: trimmed }
    },

    async createUser(
      actorUserId: string,
      input: {
        email: string
        displayName: string
        residenceId: string
        role: 'resident' | 'manager' | 'accountant'
      },
    ) {
      await requireSuperadmin(actorUserId)
      const email = input.email.trim().toLowerCase()
      const displayName = input.displayName.trim()
      if (!email.includes('@')) throw new AppError('VALIDATION', 'Email tidak valid')
      if (!displayName) throw new AppError('VALIDATION', 'Nama wajib diisi')

      const [residence] = await db
        .select()
        .from(residences)
        .where(eq(residences.id, input.residenceId))
        .limit(1)
      if (!residence) throw new AppError('NOT_FOUND', 'Perumahan tidak ditemukan')

      const createdAt = nowIso()
      const [existing] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.email, email))
        .limit(1)

      const userId = existing?.id ?? id('user')
      if (!existing) {
        await db.insert(profiles).values({ id: userId, email, displayName, createdAt })
      }

      const [alreadyMember] = await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.residenceId, input.residenceId),
          ),
        )
        .limit(1)
      if (alreadyMember) {
        throw new AppError('CONFLICT', 'User sudah terdaftar di perumahan ini')
      }

      await db.insert(memberships).values({
        id: id('mem'),
        userId,
        residenceId: input.residenceId,
        role: input.role,
        createdAt,
      })
      return { userId, email }
    },

    async setMembershipRole(
      actorUserId: string,
      input: {
        userId: string
        residenceId: string
        role: 'resident' | 'manager' | 'accountant'
      },
    ) {
      await requireSuperadmin(actorUserId)
      const rows = await db
        .update(memberships)
        .set({ role: input.role })
        .where(
          and(
            eq(memberships.userId, input.userId),
            eq(memberships.residenceId, input.residenceId),
          ),
        )
        .returning()
      if (rows.length === 0) throw new AppError('NOT_FOUND', 'Keanggotaan tidak ditemukan')
      return rows[0]
    },

    /**
     * Checks the swap is allowed and writes it down. Returns the target so the
     * caller can put it in the session.
     */
    async startImpersonation(actorUserId: string, targetUserId: string) {
      await requireSuperadmin(actorUserId)
      if (actorUserId === targetUserId) {
        throw new AppError('VALIDATION', 'Tidak bisa jadi diri sendiri')
      }

      const [target] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, targetUserId))
        .limit(1)
      if (!target) throw new AppError('NOT_FOUND', 'User tidak ditemukan')

      const targetPlatformRole = await platformRoleOf(targetUserId)
      const targetMemberships = await db
        .select()
        .from(memberships)
        .where(eq(memberships.userId, targetUserId))

      const allowed =
        targetPlatformRole === 'admin' ||
        targetMemberships.some((m) =>
          IMPERSONATABLE_RESIDENCE_ROLES.includes(
            m.role as (typeof IMPERSONATABLE_RESIDENCE_ROLES)[number],
          ),
        )
      if (!allowed) {
        throw new AppError('FORBIDDEN', 'Hanya admin, pengurus atau bendahara')
      }

      await db.insert(impersonationLog).values({
        id: id('imp'),
        actorUserId,
        targetUserId,
        startedAt: nowIso(),
        endedAt: null,
      })
      return { userId: target.id, displayName: target.displayName }
    },

    /** Closes the open entry. Who returns to their own account is the caller's job. */
    async endImpersonation(actorUserId: string) {
      await db
        .update(impersonationLog)
        .set({ endedAt: nowIso() })
        .where(
          and(
            eq(impersonationLog.actorUserId, actorUserId),
            isNull(impersonationLog.endedAt),
          ),
        )
    },
  }
}

let singleton: ReturnType<typeof createAdminStore> | null = null

export function getAdminStore() {
  if (!singleton) {
    singleton = createAdminStore(getDb())
  }
  return singleton
}
