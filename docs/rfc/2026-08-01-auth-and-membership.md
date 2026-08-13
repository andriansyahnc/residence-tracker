> **Superseded as source of truth** by [`2026-08-01-residence-problem-tracker.md`](2026-08-01-residence-problem-tracker.md) (master RFC). Kept as a topic extract.

# RFC: Auth and Membership

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-08-01 |
| PRD | [`../prd/residence-problem-tracker.md`](../prd/residence-problem-tracker.md) (§6.1, Q1, Q2, E1–E5) |
| Companion | [`system-architecture`](2026-08-01-system-architecture.md), [`netlify-database`](2026-08-01-netlify-database.md) |

## 1. Summary

Choose **email magic link** auth with users/sessions stored in **Netlify Database**, and a **single membership role per `(user, residence)`** where `manager` includes all resident capabilities. Active residence for MVP is the user’s only membership; multi-residence switcher stays deferred.

Answers PRD open questions **Q1** (auth provider) and **Q2** (role modeling). Supabase Auth is **not** used (database is Netlify Database, not Supabase).

## 2. Motivation

Auth must work without a Supabase project. Membership rules still gate every problem/comment operation. Prefer free libraries + Resend over paid auth vendors (Clerk) for MVP.

## 3. Proposal

### 3.1 Auth provider — magic link on Netlify Database

| Decision | Choice |
|----------|--------|
| Library | **Better Auth** (preferred) or **Auth.js** — pick one at implementation; both open source |
| Primary method | **Email magic link** (passwordless) |
| User / session storage | Tables in **Netlify Database** |
| Email delivery | **Resend** free tier (or SMTP) from server functions |
| Session | HTTP-only cookie; validated in TanStack Start middleware / `beforeLoad` / server functions |
| Passwords / SSO | Out of MVP |

**Why magic link**

- Residents and managers already have email; no password-reset support burden.
- Fits “raise a problem in under a minute” after first login.
- No per-MAU auth SaaS bill for MVP.

**Why not other options**

| Option | Free tier | Fit | Why not for us |
|--------|-----------|-----|----------------|
| Supabase Auth | ~50k MAU | Strong | Requires Supabase project; DB is Netlify Database |
| Clerk | Hobby MAU | Best prebuilt UI | Extra vendor + cost later |
| Netlify Identity | Included | Used in some Netlify templates | Weaker DX / localhost quirks; custom membership still needed |
| Firebase Auth | ~50k MAU | Strong | Pulls stack off Netlify DB |
| Password auth | Free | Familiar | Higher support; worse occasional-user UX |

### 3.2 Identity model

```
user (auth library)   -- id, email, name?, email_verified, created_at, ...
session / account / verification  -- per library schema
memberships            -- id, user_id, residence_id, role, created_at
                         UNIQUE (user_id, residence_id)
residences             -- id, name, created_at
```

- Creating a login does **not** grant residence access.
- Access requires a `memberships` row (PRD E1).
- Seed/ops creates memberships; no self-serve join in MVP.

### 3.3 Roles — one role per (user, residence)

**Decision:** `UNIQUE (user_id, residence_id)` with `role ∈ { resident, manager }`.

| Role | Capabilities |
|------|----------------|
| `resident` | Create problems; list/view **own** problems; comment per comments RFC |
| `manager` | Everything a resident can do **plus** list all residence problems, filter, change status, comment on any |

Live-in manager ⇒ role `manager` (implements E3 without two rows).

Permissions:

```
canCreateProblem  = role in (resident, manager)
canManageQueue    = role == manager
canComment        = per problem visibility rules in comments RFC
```

### 3.4 Active residence (MVP)

1. After login, load memberships for `session.user.id`.
2. If **zero** → “not a member” screen (E1).
3. If **one** → that residence is active.
4. If **many** → pick first or block with “contact ops”; switcher deferred. Prefer one membership per pilot user.

Never accept `residenceId` from the client alone.

### 3.5 Authorization rules (server functions)

Primary enforcement is in **server functions** querying Netlify Database (not browser RLS).

| Action | Rule |
|--------|------|
| List problems (resident) | `reporter_user_id = session.user.id` AND membership for `residence_id` |
| List problems (manager) | membership `role = manager` for `residence_id` |
| Get problem by id | Resident: own only → 404 if not (E13); Manager: any in residence; other residence → 404 (E14) |
| Update status | Manager only; allowed transitions (E2, E6, E7) |
| Comment | Per comments RFC (E17) |

Optional Postgres RLS later is defense in depth only ([`netlify-database`](2026-08-01-netlify-database.md)).

### 3.6 Sign-in UX (MVP)

1. Email field → “Send magic link”.
2. User opens link → session cookie → problem list (or not-a-member).
3. Sign out clears session.

Deep link return after login (E29) deferred.

### 3.7 Seed / first manager

Ops script against Netlify Database:

1. Create `residences` row.
2. Ensure auth user rows exist for manager + residents (invite / magic-link once).
3. Insert `memberships`.

Document in-repo; use production/staging DB URL from Netlify env — never commit secrets.

### 3.8 Account lifecycle (MVP)

| Event | Behavior |
|-------|----------|
| Membership removed | Immediate loss of list/detail (E4); problems remain for managers |
| User deleted | Defer polish; keep reporter/author ids (E20) |
| Email change | Per auth library; keep memberships on stable `user.id` |

## 4. Alternatives considered

### Auth

1. **Magic link + Better Auth/Auth.js on Netlify DB (recommended).**
2. **Netlify Identity** — possible, but membership model still custom; localhost friction.
3. **Supabase Auth + Netlify Database** — split brain; reject.
4. **Email + password** — optional later.

### Membership

1. **Single role, manager ⊇ resident (recommended).**
2. Multiple role rows + union — only if product later needs it.

## 5. Open questions

| # | Question | Suggested default |
|---|----------|-------------------|
| O1 | Better Auth vs Auth.js? | Decide at scaffold; document in ADR |
| O2 | Allow Google OAuth in MVP? | **No** |
| O3 | Magic link redirect allowlist | Production site URL + localhost |
| O4 | Display name source | Collect once after first login if missing; else email local-part |

## 6. Decision

_Filled when accepted / rejected / deferred._

| Field | Value |
|-------|-------|
| Outcome | |
| Date | |
| ADR | (link when written) |
