# RFCs

Proposed designs for review **before** implementation.

## Naming

`YYYY-MM-DD-short-title.md`  
Example: `2026-08-01-auth-and-membership.md`

## Index

### Platform

| RFC | Status | Topic |
|-----|--------|-------|
| [`2026-08-01-system-architecture.md`](2026-08-01-system-architecture.md) | Proposed | TanStack Start + Netlify Database + Netlify, tenancy, API shape |
| [`2026-08-01-netlify-database.md`](2026-08-01-netlify-database.md) | Proposed | Netlify Database (Postgres) access, migrations, env |
| [`2026-08-01-auth-and-membership.md`](2026-08-01-auth-and-membership.md) | Proposed | Magic-link auth on Netlify DB, membership roles (PRD Q1/Q2) |

### Problem tracker

| RFC | Status | Topic |
|-----|--------|-------|
| [`2026-08-01-problem-domain.md`](2026-08-01-problem-domain.md) | Proposed | Problem fields, create/list/detail, categories, validation |
| [`2026-08-01-problem-status-lifecycle.md`](2026-08-01-problem-status-lifecycle.md) | Proposed | Status machine, transitions, reopen, concurrency |
| [`2026-08-01-problem-comments.md`](2026-08-01-problem-comments.md) | Proposed | Append-only comments, visibility, reject comment |
| [`2026-08-01-problem-tracker-ux.md`](2026-08-01-problem-tracker-ux.md) | Proposed | Mobile screens, empty/error states, IA |
| [`2026-08-01-problem-validation-and-edge-cases.md`](2026-08-01-problem-validation-and-edge-cases.md) | Proposed | MVP edge-case checklist + test gate |

## When to open an RFC

- Auth, tenancy, or data-model changes
- Multi-residence UX (switcher, invites)
- Notifications, attachments, or other deferred PRD items
- Anything with meaningful trade-offs that should be debated in writing

## Suggested sections

1. Summary  
2. Motivation (link PRD if any)  
3. Proposal  
4. Alternatives considered  
5. Open questions  
6. Decision (filled when accepted / rejected / deferred)
