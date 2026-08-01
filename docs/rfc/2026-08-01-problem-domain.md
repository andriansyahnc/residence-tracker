# RFC: Problem Domain (Create, List, Detail)

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-08-01 |
| PRD | [`../prd/residence-problem-tracker.md`](../prd/residence-problem-tracker.md) (§4, §6.2, §7, E9–E14, E25–E28) |
| Related | [`problem-status-lifecycle`](2026-08-01-problem-status-lifecycle.md), [`problem-comments`](2026-08-01-problem-comments.md), [`problem-tracker-ux`](2026-08-01-problem-tracker-ux.md), [`auth-and-membership`](2026-08-01-auth-and-membership.md), [`system-architecture`](2026-08-01-system-architecture.md) |

## 1. Summary

Define the **Problem** entity and MVP operations: create, list (resident vs manager), and detail. Status transitions and comments are separate RFCs; this one owns fields, validation, visibility for reads/creates, and tenancy invariants.

## 2. Motivation

The PRD’s core object is a residence-scoped problem ticket. Implementation needs a single place for field rules, list semantics, and “who can see which rows” before coding server functions.

## 3. Proposal

### 3.1 Entity

Table `problems` (snake_case in DB):

| Field | Type | Rules |
|-------|------|--------|
| `id` | uuid | PK, generated |
| `residence_id` | uuid | NOT NULL; FK → `residences`; always from membership context |
| `reporter_user_id` | uuid | NOT NULL; FK → auth user; set to `auth.uid()` on create |
| `title` | text | Required; trim; non-empty after trim |
| `description` | text | Required; trim; non-empty; max **5000** chars (E11) |
| `unit` | text null | Optional location/unit (E27) |
| `category` | enum null | Optional; see §3.2 |
| `status` | enum | Default `submitted` on create; transitions in lifecycle RFC |
| `created_at` | timestamptz | UTC |
| `updated_at` | timestamptz | UTC; bump on any successful mutation |
| `status_changed_at` | timestamptz | UTC; set on create (= created) and on every status change |

No soft-delete in MVP. No attachments. No merge/link fields (E9 deferred).

### 3.2 Category enum

```
maintenance | facilities | safety | noise | other
```

- Optional on create; null allowed.
- Stored as Postgres enum or check constraint.
- UI: select with those five values; no free-text category in MVP.
- Changing category after create: **out of MVP** (defer); managers clarify via comments.

### 3.3 Create

| Rule | Detail |
|------|--------|
| Who | Membership with `canCreateProblem` (`resident` or `manager` per auth RFC) |
| Residence | Server sets `residence_id` from active membership — never trust client alone (E25) |
| Reporter | Always `auth.uid()` |
| Initial status | `submitted`; `status_changed_at = created_at` |
| Validation | Reject whitespace-only title/description (E10); reject description > 5000 (E11) |
| Rate limit | Light per-user limit (e.g. 10 creates / hour); soft 429 (E12) |
| Duplicates | Allowed as separate rows (E9); no automatic dedupe |

### 3.4 List

| Viewer | Scope | Default sort | Filters |
|--------|-------|--------------|---------|
| Resident | `reporter_user_id = auth.uid()` AND active `residence_id` | `created_at` DESC (newest first) | None in MVP (optional later) |
| Manager | All problems for active `residence_id` | `created_at` DESC | Optional `status` (single or multi-chip) |

List row payload (MVP): `id`, `title`, `status`, `updated_at`, optional `category`, optional `unit`. Do not include full description in list responses (keep payloads small for mobile).

### 3.5 Detail

Return for authorized viewer:

- All problem fields above
- Comment thread (see comments RFC) — oldest-first or newest-first: **oldest-first** (chat style)
- Reporter display: `profiles.display_name` (or email local-part); if profile missing, show stable fallback string

Authorization:

| Case | Response |
|------|----------|
| Unauthenticated | Deny (E15) |
| Resident, not reporter | **404** (prefer over 403 — do not confirm existence) (E13) |
| Member, wrong residence | **404** (E14) |
| Manager, same residence | OK |
| Resident, own problem | OK |

### 3.6 Mutations owned elsewhere

| Concern | RFC |
|---------|-----|
| Status changes | [`problem-status-lifecycle`](2026-08-01-problem-status-lifecycle.md) |
| Comments | [`problem-comments`](2026-08-01-problem-comments.md) |
| Edit title/description after create | **Reject for MVP** — new info goes in comments |
| Delete problem | **Reject for MVP** |

### 3.7 Timestamps and timezone

- Store all timestamps in **UTC** (E28).
- UI formats with device local timezone (relative time on list, absolute on detail).

### 3.8 Server function surface (names)

Aligned with architecture RFC:

- `createProblem({ title, description, unit?, category? })`
- `listProblems({ status? })` — behavior branches on role
- `getProblem({ problemId })`

## 4. Alternatives considered

| Option | Verdict |
|--------|---------|
| Global problem list without residence | Reject — violates PRD §8 |
| Residents see all building problems | Reject for MVP (PRD Q6); transparency mode later |
| Required unit field | Reject — optional (E27) |
| Rich text / markdown description | Reject for MVP — plain text |
| Separate “ticket number” sequence per residence | Defer — use uuid short display if needed |

## 5. Open questions

| # | Question | Suggested default |
|---|----------|-------------------|
| O1 | Title max length? | **200** chars |
| O2 | Unit max length? | **100** chars |
| O3 | List page size? | **50**; simple “load more” if needed |
| O4 | Should create allow managers only via same form? | **Yes** — same create path |

## 6. Decision

_Filled when accepted / rejected / deferred._

| Field | Value |
|-------|-------|
| Outcome | |
| Date | |
| ADR | |
