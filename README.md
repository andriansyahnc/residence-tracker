# Residence Problem Tracker MVP

[![Netlify Status](https://api.netlify.com/api/v1/badges/7b450f64-2215-4f9d-bf81-1fea60064c7a/deploy-status)](https://app.netlify.com/projects/residence-tracker/deploys)

Mobile-first problem tracker for a single residence. Built with TanStack Start, Drizzle ORM, and **Netlify Database** (Postgres).

## Docs

| Doc | Path |
|-----|------|
| PRD | [`docs/prd/residence-problem-tracker.md`](docs/prd/residence-problem-tracker.md) |
| Master RFC | [`docs/rfc/2026-08-01-residence-problem-tracker.md`](docs/rfc/2026-08-01-residence-problem-tracker.md) |
| Other RFCs | [`docs/rfc/`](docs/rfc/) |
| ADRs | [`docs/adr/`](docs/adr/) |
| UI snapshots index | [`docs/ui-snapshots.md`](docs/ui-snapshots.md) |

## Quick start (local)

```bash
cd residence-tracker
pnpm install
pnpm exec netlify dev
```

Open the URL shown (usually http://localhost:8888) and use demo login:
- **Resident:** `resident@example.com`
- **Manager:** `manager@example.com`

## Tests (TDD)

```bash
pnpm test
```

Domain logic (status machine, permissions, validation) and Drizzle-backed store are covered by Vitest (in-memory Postgres via PGlite).

## Database (Netlify Database + Drizzle)

- Schema: `src/db/schema.ts`
- Migrations: `netlify/database/migrations/` (applied automatically on Netlify deploy)
- Local: `netlify dev` sets `NETLIFY_DB_URL` with a local Postgres branch

```bash
pnpm db:generate                      # after schema changes
pnpm exec netlify database status
pnpm exec netlify database connect      # interactive SQL client
```

Demo users are seeded in migration `0002_seed_demo_data.sql`.

## Netlify deploy

Site: https://residence-tracker.netlify.app

Required env var: **`SESSION_SECRET`** (min 32 chars) in Site configuration.

```bash
pnpm exec netlify deploy --prod
```

## Docker / OrbStack (optional)

Docker runs the UI shell only — use **`netlify dev`** for full-stack local work with Postgres.

## Stack

| Layer | Choice |
|-------|--------|
| App | TanStack Start + React |
| Hosting | Netlify |
| ORM | Drizzle |
| DB | **Netlify Database** (Postgres) |
| Auth (MVP) | Cookie session + seeded email login |

## MVP scope

- Resident: create/list own problems, comment
- Manager: all problems, status transitions, filter by status, comment
- Status machine per PRD (`submitted` → … → `closed` / `rejected`)
- Tenancy via `residence_id` on all domain rows
