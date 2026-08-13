# RFC: Residence Problem Tracker (Master)

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-08-01 |
| PRD | [`../prd/residence-problem-tracker.md`](../prd/residence-problem-tracker.md) |
| UI snapshots | [`../ui-snapshots.md`](../ui-snapshots.md) |
| Split RFCs | Superseded as sources of truth — kept as topic extracts under [`README`](README.md) |

This is the **single design RFC** for MVP: platform, auth, data, problem domain, status machine, comments, UX, and acceptance edge cases.

---

## Table of contents

1. [Summary](#1-summary)
2. [Motivation & constraints](#2-motivation--constraints)
3. [Stack & architecture](#3-stack--architecture)
4. [Netlify Database](#4-netlify-database)
5. [Auth & membership](#5-auth--membership)
6. [Problem domain](#6-problem-domain)
7. [Status lifecycle](#7-status-lifecycle)
8. [Comments](#8-comments)
9. [Mobile UX](#9-mobile-ux)
10. [Validation, errors & edge cases](#10-validation-errors--edge-cases)
11. [Alternatives considered](#11-alternatives-considered)
12. [Open questions](#12-open-questions)
13. [Decision](#13-decision)

---

## 1. Summary

Build a **mobile-first web** residence problem tracker:

| Piece | Choice |
|-------|--------|
| App | **TanStack Start** (React) + TypeScript + Tailwind + shadcn/ui |
| Host | **Netlify** (`@netlify/vite-plugin-tanstack-start`) |
| Database | **Netlify Database** (Postgres / Neon) — server-only access |
| Auth | **Magic link** (Better Auth or Auth.js) + **Resend**; sessions in Netlify DB |
| Tenancy | `residence_id` on all domain rows; membership-gated server functions |
| Roles | One role per `(user, residence)`: `resident` \| `manager` (`manager` ⊇ resident) |
| Product | Create / list / detail problems; status machine; append-only comments |

**Out of MVP:** native apps, payments, push/SMS notifications, attachments, private manager notes, multi-residence switcher UI, Supabase, analytics dashboards, self-serve onboarding.

---

## 2. Motivation & constraints

PRD goals: raise a problem in under a minute; always see status; manager queue; comments; multi-residence-ready model at launch of one residence.

Author constraints:

1. Prefer known-good design over inventing one.
2. Free / credit-tier tools only for MVP.
3. Prefer **Netlify** for hosting **and** database.

---

## 3. Stack & architecture

### 3.1 Layers

| Layer | Choice | Notes |
|-------|--------|-------|
| App | TanStack Start + TanStack Router | Server functions + SSR |
| UI | Tailwind + shadcn/ui | Boring defaults OK |
| DB | Netlify Database | `NETLIFY_DATABASE_URL` |
| Auth | Better Auth *(preferred)* or Auth.js | Magic link |
| Email | Resend free tier | Magic-link delivery |
| ORM | Drizzle | On Netlify DB URL |
| Package manager | pnpm | — |
| CI | GitHub Actions | Lint / typecheck / test |

**Deploy:**

- `vite.config.ts`: `tanstackStart()` + `netlify()`
- `netlify db init` → DB URL
- `netlify.toml`: `vite build`, publish `dist/client` (or CLI defaults)

### 3.2 Runtime shape

```
Browser (mobile UI)
    │ cookie session
    ▼
TanStack Start on Netlify
  · route loaders / server functions
  · session + membership checks
    │ NETLIFY_DATABASE_URL (server-only)
    ▼
Netlify Database (Postgres)
  · auth tables · residences · memberships
  · problems · comments
```

No browser → database. No public anon DB key.

### 3.3 Domain tables (overview)

| PRD | Table |
|-----|-------|
| Residence | `residences` |
| User | auth `user` (+ profile fields) |
| Membership | `memberships` |
| Problem | `problems` |
| Comment | `comments` |

### 3.4 Server functions (MVP)

| Function | Who |
|----------|-----|
| `createProblem` | resident / manager |
| `listProblems` | member (scoped by role) |
| `getProblem` | authorized member |
| `updateProblemStatus` | manager |
| `addComment` | per §8 rules |

---

## 4. Netlify Database

| Item | Choice |
|------|--------|
| Product | Netlify Database (Postgres on Neon) |
| Access | Server-only via Start / seed scripts |
| Migrations | Drizzle (preferred) or SQL |
| Authz | App-level in server functions; optional RLS later |
| Previews | DB branches when plan allows |

**Indexes:**

- `problems (residence_id, created_at)`
- `problems (residence_id, status)`
- `problems (reporter_user_id)`
- `memberships (user_id, residence_id)` UNIQUE
- `comments (problem_id, created_at)`

**Env (server-only — never `VITE_`):**

- `NETLIFY_DATABASE_URL`
- Auth secret (e.g. `BETTER_AUTH_SECRET`)
- `RESEND_API_KEY`

**Risks:** credit-plan compute/bandwidth; DB sleep → cold start. Acceptable for one-residence pilot.

---

## 5. Auth & membership

### 5.1 Auth

| Decision | Choice |
|----------|--------|
| Method | Email magic link |
| Storage | Users/sessions in Netlify Database |
| Session | HTTP-only cookie; check in middleware / `beforeLoad` / server fns |
| Passwords / SSO | Out of MVP |

Rejected for MVP: Supabase Auth, Clerk, Firebase Auth, Netlify Identity (as primary).

### 5.2 Roles

`UNIQUE (user_id, residence_id)` · `role ∈ { resident, manager }`

| Role | Can |
|------|-----|
| `resident` | Create; list/view **own**; comment per §8 |
| `manager` | All resident powers + queue + status + comment on any |

```
canCreateProblem = role in (resident, manager)
canManageQueue   = role == manager
```

Login alone does **not** grant access — need `memberships` row (E1).

### 5.3 Active residence (MVP)

1. Load memberships for session user.
2. Zero → `/not-a-member`.
3. One → that residence is active.
4. Many → pick first or block; switcher deferred. Prefer seeding one membership per pilot user.

Never trust client-only `residenceId`.

### 5.4 Seed

Ops script: create residence → ensure users → insert memberships. No self-serve join.

---

## 6. Problem domain

### 6.1 `problems` fields

| Field | Rules |
|-------|--------|
| `id` | uuid PK |
| `residence_id` | from membership context |
| `reporter_user_id` | `session.user.id` on create |
| `title` | required; trim; max **200** |
| `description` | required; trim; max **5000** |
| `unit` | optional; max **100** |
| `category` | optional enum: `maintenance \| facilities \| safety \| noise \| other` |
| `status` | default `submitted` |
| `created_at` / `updated_at` / `status_changed_at` | UTC |

No edit title/description after create; no delete; no attachments; duplicates allowed as separate rows.

### 6.2 Create / list / detail

| Op | Rules |
|----|--------|
| Create | `canCreateProblem`; rate limit ~10/hour; initial `submitted` |
| List (resident) | own only; newest first |
| List (manager) | all in residence; optional status filter; newest first |
| Detail | fields + comments oldest→newest; peer/other-residence → **404** |

List payload: `id`, `title`, `status`, `updated_at`, optional `category`/`unit` (no full description).

---

## 7. Status lifecycle

### 7.1 Values & paths

```
submitted → acknowledged → in_progress → resolved → closed
submitted → rejected
acknowledged → rejected
resolved → in_progress     (reopen)
closed → in_progress       (reopen)
```

`rejected` is **terminal** in MVP. Residents never change status.

### 7.2 Transition table

| From | To | Extra |
|------|-----|--------|
| `submitted` | `acknowledged` | — |
| `submitted` | `in_progress` | skip ack allowed |
| `submitted` | `rejected` | **require comment** |
| `acknowledged` | `in_progress` | — |
| `acknowledged` | `rejected` | **require comment** |
| `in_progress` | `resolved` | — |
| `resolved` | `closed` | — |
| `resolved` / `closed` | `in_progress` | reopen |

Illegal jumps → **400**. Resident → **403**.

### 7.3 API & concurrency

```
updateProblemStatus({ problemId, expectedStatus, nextStatus, commentBody? })
```

- Stale `expectedStatus` → **409** (optimistic lock).
- Reject: insert comment in **same transaction**.
- Shared pure helper: `canTransition(from, to, role)`.
- Optional column: `status_changed_by`.

No full audit table in MVP.

---

## 8. Comments

### 8.1 `comments` fields

`id`, `problem_id`, `residence_id` (denormalized), `author_user_id`, `body` (max **2000**), `created_at`.

Append-only: no edit/delete. All comments shared (no private notes).

### 8.2 Who may post

| Actor | Rule |
|-------|------|
| Resident | Own problems only; **not** when `closed` / `rejected`; OK on `resolved` |
| Manager | Any problem in residence, including closed/rejected |

API: `addComment({ problemId, body })` → bump problem `updated_at`. Rate ~60/hour.

---

## 9. Mobile UX

### 9.1 Routes

| Route | Purpose |
|-------|---------|
| `/login` | Magic link |
| `/` or `/problems` | Role list |
| `/problems/new` | Create form |
| `/problems/$problemId` | Detail + comments (+ manager status) |
| `/not-a-member` | E1 empty state |

### 9.2 Screens

1. **List** — status chip · title · relative time; sticky **New problem**; manager status filter chips; empty copy.
2. **New** — title, description, unit?, category?; disable while in flight; error + retry on network fail; success → detail.
3. **Detail** — status badge → meta → body → manager status control → comments → composer (hide for resident on closed/rejected).

Use text labels with status colors (not color alone). ~44px tap targets. Store UTC; show local time.

Visual brand: shadcn defaults unless a design system is adopted later. Snapshot index: [`../ui-snapshots.md`](../ui-snapshots.md).

---

## 10. Validation, errors & edge cases

### 10.1 Limits

| Field | Min | Max |
|-------|-----|-----|
| Title | 1 trimmed | 200 |
| Description | 1 trimmed | 5000 |
| Unit | 0 | 100 |
| Comment | 1 trimmed | 2000 |
| Creates / user / hour | — | 10 |
| Comments / user / hour | — | 60 |

### 10.2 Error shape

```
{ error: { code: 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'RATE_LIMITED', message: string, fields?: Record<string, string> } }
```

Prefer **404** over 403 when hiding peer/cross-residence problems.

### 10.3 Must implement (PRD §9.8)

E1–E14, E17, E19, E21–E23, E25–E28.

### 10.4 Deferred / rejected

| ID | Handling |
|----|----------|
| E9 merge/link | Defer |
| E12 heavy moderation | Defer |
| E16 private notes | Defer |
| E18 edit/delete comment | Reject MVP |
| E20 former-user polish | Defer |
| E24 residence delete | Defer |
| E29 login deep-link return | Defer |

### 10.5 MVP test gate

1. Resident create → list own → detail.  
2. Peer detail → 404.  
3. Manager list + status filter.  
4. Allowed transitions OK; illegal → 400.  
5. Reject needs comment; comment visible.  
6. Reopen `closed` → `in_progress`.  
7. Resident cannot comment on `closed`; manager can.  
8. Stale status → 409.  
9. Non-member cannot create.  
10. Whitespace title fails.

---

## 11. Alternatives considered

| Option | Verdict |
|--------|---------|
| TanStack Start + Netlify DB + Netlify | **Choose** |
| Next.js + Vercel + Supabase | Reject (host/DB preference) |
| TanStack Start + Supabase + Netlify | Reject (second BaaS) |
| Next.js on Netlify | Reject (worse than Start on Netlify) |
| Firebase | Reject (document model) |
| Clerk / Netlify Identity as primary auth | Reject for MVP |
| Multiple membership role rows | Reject — single role, manager ⊇ resident |
| Residents see all building problems | Reject MVP (PRD Q6) |
| Full status audit log | Defer |
| Realtime list updates | Defer — refresh on nav |

---

## 12. Open questions

| # | Question | Suggested default |
|---|----------|-------------------|
| O1 | Better Auth vs Auth.js? | Prefer Better Auth if Start integration is smoother |
| O2 | Google OAuth in MVP? | No |
| O3 | Preview DB branching day one? | Yes if plan allows |
| O4 | Neon RLS in MVP? | No |
| O5 | TanStack Query day one? | No |
| O6 | Sticky bar vs FAB for New? | Sticky bottom bar |
| O7 | Confirm before Close/Reject? | Yes for Reject; soft for Close |
| O8 | `status_changed_by` column? | Yes |

---

## 13. Decision

_Filled when accepted / rejected / deferred._

| Field | Value |
|-------|-------|
| Outcome | |
| Date | |
| ADR | (link when written) |
