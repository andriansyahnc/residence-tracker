# Residence Problem Tracker MVP

Mobile-first problem tracker for a single residence. Built with TanStack Start, Drizzle ORM, and SQLite (Postgres-ready path via RFC).

## Quick start (local)

```bash
cd residence-tracker
pnpm install
pnpm dev
```

Open http://localhost:3000/login and use demo buttons:
- **Resident:** `resident@example.com`
- **Manager:** `manager@example.com`

## Tests (TDD)

```bash
pnpm test
```

Domain logic (status machine, permissions, validation) and Drizzle-backed store are covered by Vitest.

## Database (Drizzle)

- Schema: `src/db/schema.ts`
- Migrations: `drizzle/`
- Local SQLite file: `data/residence-tracker.sqlite` (auto-created on first run)

```bash
pnpm db:generate   # after schema changes
pnpm db:push       # push schema to local db
```

## Docker / OrbStack

Works with Docker Desktop or [OrbStack](https://orbstack.dev/).

```bash
cd residence-tracker
docker compose up --build
```

App runs at http://localhost:3000. Data persists in the `residence-data` volume.

Override secrets via `.env`:

```bash
cp .env.example .env
# edit SESSION_SECRET (min 32 chars)
docker compose up --build
```

Production preview inside the container uses `pnpm start` (Vite preview on port 3000).

## Stack

| Layer | Choice |
|-------|--------|
| App | TanStack Start + React |
| ORM | **Drizzle** (not Prisma) |
| DB (MVP) | SQLite via better-sqlite3 |
| Auth (MVP) | Cookie session + seeded email login |
| Target (RFC) | Supabase Postgres + magic link |

## MVP scope

- Resident: create/list own problems, comment
- Manager: all problems, status transitions, filter by status, comment
- Status machine per PRD (`submitted` → … → `closed` / `rejected`)
- Tenancy via `residence_id` on all domain rows
