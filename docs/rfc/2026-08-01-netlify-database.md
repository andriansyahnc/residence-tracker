> **Superseded as source of truth** by [`2026-08-01-residence-problem-tracker.md`](2026-08-01-residence-problem-tracker.md) (master RFC). Kept as a topic extract.

# RFC: Netlify Database (Postgres)

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-08-01 |
| PRD | [`../prd/residence-problem-tracker.md`](../prd/residence-problem-tracker.md) |
| Related | [`system-architecture`](2026-08-01-system-architecture.md), [`auth-and-membership`](2026-08-01-auth-and-membership.md), problem-tracker RFCs |

## 1. Summary

Use **Netlify Database** (managed serverless Postgres, Neon under the hood) as the **only** application database for the Residence Problem Tracker. All domain tables (`residences`, `profiles` / users, `memberships`, `problems`, `comments`, plus auth session tables) live here. The browser never opens a direct DB connection — TanStack Start **server functions** query via `NETLIFY_DATABASE_URL`.

## 2. Motivation

Hosting is already Netlify + TanStack Start. Netlify Database keeps Postgres inside the same platform: provision with CLI, preview branching, and one vendor for host + data. That replaces the earlier Supabase-Postgres choice so we are not split across two BaaS databases.

Constraints: stay on free / credit-based Netlify plans where possible; keep the PRD’s `residenceId` tenancy model.

## 3. Proposal

### 3.1 Product choice

| Item | Choice |
|------|--------|
| Database | **Netlify Database** (Postgres) |
| Engine | Neon (managed by Netlify; no need to use Neon console for MVP) |
| Provision | `netlify db init` (or dashboard); sets `NETLIFY_DATABASE_URL` |
| Client access | **Server-only** from Start server functions / seed scripts |
| Package | Official Netlify DB client / `@netlify/neon` (or Drizzle over the same URL) |

### 3.2 Access pattern

```
Browser → TanStack Start server function → Netlify Database
                ↑
         session user id + membership checks
```

- Do **not** expose the database URL or a public anon DB key to the client.
- Authorization is enforced in server functions (see auth RFC): resolve user → membership → filter by `residence_id` / reporter rules.
- Optional later: Postgres RLS / Neon Authorize as defense in depth — **not required for MVP** if all queries are server-scoped and parameterized.

### 3.3 Schema ownership

Migrations: SQL files or **Drizzle** migrations (Netlify `db init` can scaffold Drizzle). Same logical schema as architecture / problem-domain RFCs:

- `residences`, `memberships`, `problems`, `comments`
- Auth tables as required by the chosen auth library (users, sessions, verification tokens)
- `profiles` may be merged with the auth `user` table if the library already stores `name` / `email`

Indexes (MVP):

- `problems (residence_id, created_at desc)`
- `problems (residence_id, status)`
- `problems (reporter_user_id)`
- `memberships (user_id, residence_id)` unique
- `comments (problem_id, created_at)`

### 3.4 Environments

| Env | Behavior |
|-----|----------|
| Local | `netlify dev` / linked site provisions or injects DB URL |
| Deploy previews | Prefer DB **branches** when available so PRs do not smash production data |
| Production | Single primary DB for the pilot residence |

Seed script (ops): create residence + manager/resident memberships against production or a staging DB; never commit secrets.

### 3.5 Free / credit-plan notes

Netlify Database is on **credit-based plans**. Free-tier shape (verify before launch — limits change):

- Limited databases / branches per account
- Compute sleeps after inactivity (cold start latency acceptable for MVP)
- Storage / compute / bandwidth caps — one residence of tickets fits easily if limits are in the GB range

Mitigations: keep queries simple; avoid chatty N+1; accept sleep wake on free tier.

### 3.6 What we stop using

| Former idea | Now |
|-------------|-----|
| Supabase Postgres | Replaced by Netlify Database |
| Supabase client from browser + RLS-as-primary | Replaced by server functions + membership checks |
| Supabase Storage for MVP attachments | Still deferred; revisit later (Netlify Blobs or other) |

## 4. Alternatives considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Netlify Database (recommended)** | Same platform as host; Postgres; preview branches | Credit-plan limits; auth not bundled | **Choose** |
| Supabase Postgres + Netlify host | Auth+RLS bundled | Two vendors; fights “all Netlify” preference | Reject |
| Neon direct (outside Netlify DB) | Same engine | Extra account; loses Netlify DB workflow | Reject for MVP |
| PlanetScale / SQLite | — | Wrong model or weak multi-tenant fit | Reject |

## 5. Open questions

| # | Question | Suggested default |
|---|----------|-------------------|
| O1 | Drizzle vs raw SQL migrations? | **Drizzle** if `netlify db init` offers it; else SQL |
| O2 | Enable Neon RLS in MVP? | **No** — app authz first; add later if client ever talks to DB |
| O3 | Preview DB branching from day one? | **Yes** if plan allows; else shared staging DB |

## 6. Decision

_Filled when accepted / rejected / deferred._

| Field | Value |
|-------|-------|
| Outcome | |
| Date | |
| ADR | |
