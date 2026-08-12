# RFCs

Proposed designs for review **before** implementation.

## Naming

`YYYY-MM-DD-short-title.md`

## Index

### Master (read this)

| RFC | Status | Topic |
|-----|--------|-------|
| [`2026-08-01-residence-problem-tracker.md`](2026-08-01-residence-problem-tracker.md) | Proposed | **Full MVP design** — stack, DB, auth, problems, status, comments, UX, edge cases |
| [`2026-08-12-ipl-tracker.md`](2026-08-12-ipl-tracker.md) | Accepted | **IPL add-on** — dues, proofs, accountant role, combined report/PDF, PWA (delta on problem-tracker master) |

### Topic extracts (superseded as source of truth)

Kept for easier navigation / git history. If they disagree with the master RFC, **the master wins**.

| RFC | Topic |
|-----|-------|
| [`2026-08-01-system-architecture.md`](2026-08-01-system-architecture.md) | Stack & architecture |
| [`2026-08-01-netlify-database.md`](2026-08-01-netlify-database.md) | Netlify Database |
| [`2026-08-01-auth-and-membership.md`](2026-08-01-auth-and-membership.md) | Auth & roles |
| [`2026-08-01-problem-domain.md`](2026-08-01-problem-domain.md) | Problem create/list/detail |
| [`2026-08-01-problem-status-lifecycle.md`](2026-08-01-problem-status-lifecycle.md) | Status machine |
| [`2026-08-01-problem-comments.md`](2026-08-01-problem-comments.md) | Comments |
| [`2026-08-01-problem-tracker-ux.md`](2026-08-01-problem-tracker-ux.md) | Mobile UX |
| [`2026-08-01-problem-validation-and-edge-cases.md`](2026-08-01-problem-validation-and-edge-cases.md) | Edge-case checklist |

## When to open an RFC

- Auth, tenancy, or data-model changes
- Multi-residence UX (switcher, invites)
- Notifications, attachments, or other deferred PRD items
- Anything with meaningful trade-offs that should be debated in writing

Prefer amending the **master** RFC (or writing a focused delta RFC that links to it) over proliferating parallel full designs.

## Suggested sections

1. Summary  
2. Motivation (link PRD if any)  
3. Proposal  
4. Alternatives considered  
5. Open questions  
6. Decision (filled when accepted / rejected / deferred)
