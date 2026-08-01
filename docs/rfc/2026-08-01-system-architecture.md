# RFC: System Architecture (Residence Problem Tracker)

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-08-01 |
| PRD | [`../prd/residence-problem-tracker.md`](../prd/residence-problem-tracker.md) |
| Companion | [`auth-and-membership`](2026-08-01-auth-and-membership.md), [`netlify-database`](2026-08-01-netlify-database.md) |

## 1. Summary

Propose a **free / credit-tier-first** architecture for the Residence Problem Tracker MVP: **TanStack Start** + **Netlify Database** (Postgres) + **Netlify** hosting. Auth is passwordless magic link with sessions stored in Netlify Database (see auth RFC). Tenancy is `residenceId` on every domain row, enforced in **server functions** (membership checks).

## 2. Motivation

The PRD needs a lean ticket product for one residence at launch, multi-residence-ready in the data model, with zero paid tooling if possible. Hosting preference is **Netlify**; the database should live on the same platform (**Netlify Database**) rather than a second BaaS.

Constraints from the author:

1. Prefer a known-good design over inventing one.
2. Stay on free tools / free tiers for MVP.
3. Prefer Netlify (host + database).

## 3. Proposal

### 3.1 Recommended stack

| Layer | Choice | Why | Free / credit notes (verify before launch) |
|-------|--------|-----|--------------------------------------------|
| App | **TanStack Start** (React) + TypeScript | Full-stack React; first-class Netlify deploy | Open source |
| Router / data | **TanStack Router** (+ Query later if needed) | Type-safe routes | Open source |
| UI | **Tailwind CSS** + **shadcn/ui** | Fast mobile UI without a custom brand system | Open source |
| Database | **Netlify Database** (Postgres / Neon) | Same platform as host; serverless Postgres | Credit-based; see [`netlify-database`](2026-08-01-netlify-database.md) |
| Auth | Magic link via **Better Auth** or **Auth.js** | Users/sessions in Netlify DB; no Supabase required | Library open source; email via Resend free tier |
| Hosting | **Netlify** | Official TanStack Start adapter | Free / starter credits |
| Email (auth) | **Resend** (or Netlify-compatible SMTP) | Magic-link delivery | Resend free tier for MVP volume |
| Repo / CI | **GitHub** | Lint/typecheck; Netlify deploy previews | Free minutes enough for MVP |

**Deploy wiring (MVP):**

- Dev dependency: `@netlify/vite-plugin-tanstack-start`
- `vite.config.ts`: `tanstackStart()` + `netlify()` plugins
- `netlify db init` → `NETLIFY_DATABASE_URL`
- `netlify.toml`: build `vite build`, publish `dist/client` (or CLI auto-configure)

**Out of MVP stack (defer):** Stripe, Redis, file storage, Sentry paid plans, native apps, push providers, Supabase.

### 3.2 Architecture overview

```
┌─────────────────────────────────────────┐
│  Browser (mobile-first TanStack UI)     │
│  Resident list / Manager queue / Detail │
└─────────────────┬───────────────────────┘
                  │ HTTPS (cookie session)
┌─────────────────▼───────────────────────┐
│  TanStack Start on Netlify              │
│  - SSR routes + Server Functions        │
│  - Session + membership authorization   │
└─────────────────┬───────────────────────┘
                  │ NETLIFY_DATABASE_URL (server-only)
┌─────────────────▼───────────────────────┐
│  Netlify Database (Postgres)            │
│  - Domain tables (residence-scoped)     │
│  - Auth user / session tables           │
│  - Seed data for first residence        │
└─────────────────────────────────────────┘
```

**Pattern:** shared-schema multi-tenancy — one database, `residence_id` on domain tables, **server-enforced** membership filters. Matches the PRD’s “scope every record by `residenceId`”.

### 3.3 Domain mapping

PRD entities map 1:1 to Postgres tables (snake_case in DB):

| PRD | Table | Notes |
|-----|-------|-------|
| Residence | `residences` | Seeded for MVP |
| User | auth `user` (+ `profiles` if split) | Display name / email |
| Membership | `memberships` | `user_id`, `residence_id`, `role` |
| Problem | `problems` | Status machine in app + CHECK |
| Comment | `comments` | Append-only; `residence_id` denormalized |

Invariants:

- Every query for problems/comments filters by active `residence_id`.
- Resident problem reads further restricted to `reporter_user_id = session.user.id`.
- Never trust client-supplied `residence_id` without membership check.
- No direct browser → database access in MVP.

### 3.4 API surface (MVP)

Prefer **TanStack Start server functions**:

| Action | Who | Behavior |
|--------|-----|----------|
| `createProblem` | Resident (+ manager) | Validate; set `submitted` |
| `listProblems` | Member | Own-only vs all-by-status filter |
| `getProblem` | Authorized member | Detail + comments |
| `updateProblemStatus` | Manager | Allowed transitions only; set `status_changed_at` |
| `addComment` | Per comments RFC | Append-only |

Status machine stays in one shared module (invalid jumps → 400). Optimistic concurrency via `expectedStatus` (PRD E21).

### 3.5 UX shell

Ship a boring, proven mobile pattern (details in [`problem-tracker-ux`](2026-08-01-problem-tracker-ux.md)):

1. Top app bar: residence name + role badge.
2. Full-width list (status chip + title + relative time).
3. Sticky primary **“New problem”**.
4. Detail: status → body → comments → composer; manager status control.
5. Manager list: status filter chips.

### 3.6 Ops / seed

- SQL or Drizzle seed: residence + manager/resident memberships.
- No self-serve onboarding in MVP.
- Env:
  - Server: `NETLIFY_DATABASE_URL` (injected by Netlify)
  - Auth secrets: e.g. `BETTER_AUTH_SECRET` / Auth.js secret (server-only)
  - Email: `RESEND_API_KEY` (server-only)
  - Never prefix DB URL or secrets with `VITE_`

### 3.7 Security baseline

1. All DB access from trusted server code only.
2. Every domain mutation/query checks session + membership.
3. Indexes per [`netlify-database`](2026-08-01-netlify-database.md) / problem-domain RFC.
4. Light rate limit on `createProblem` (PRD E12).
5. Optional Postgres RLS later — not MVP-blocking.

### 3.8 What this deliberately does not include

- Photo storage
- Notifications (email/push beyond magic link)
- Multi-residence switcher UI
- Analytics product
- Supabase (DB or Auth)

## 4. Alternatives considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **A. TanStack Start + Netlify Database + Netlify (recommended)** | One platform for host+DB; Start first-class on Netlify | Auth not bundled; credit-plan DB limits | **Choose** |
| **B. TanStack Start + Supabase + Netlify** | Auth+RLS bundled | Second vendor for data; weaker Netlify DB fit | Reject given Netlify DB preference |
| **C. Next.js + Vercel + Supabase** | Common starters | Wrong host preference | Reject |
| **D. Firebase** | Strong free tier | Document model fights tickets/comments | Reject |

## 5. Free-tier / credit risk notes

| Risk | Mitigation |
|------|------------|
| Netlify DB sleeps / cold start | Accept for MVP; keep transactions short |
| Credit compute / bandwidth caps | One residence; simple queries |
| Magic-link email deliverability | Resend free tier; verify domain if spam |
| No SLA on free tiers | Acceptable for single-residence pilot |

## 6. Open questions

| # | Question | Suggested default |
|---|----------|-------------------|
| O1 | Better Auth vs Auth.js? | Prefer **Better Auth** if TanStack Start integration is smoother; else Auth.js |
| O2 | Package manager? | `pnpm` |
| O3 | ORM? | **Drizzle** on `NETLIFY_DATABASE_URL` |
| O4 | Attachments later? | Still defer (PRD) |
| O5 | TanStack Query day one? | **No** |

## 7. Decision

_Filled when accepted / rejected / deferred._

| Field | Value |
|-------|-------|
| Outcome | |
| Date | |
| ADR | (link when written) |
