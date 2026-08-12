# PRD: Residence Problem Tracker

| Field | Value |
|-------|-------|
| Status | Draft |
| Date | 2026-08-01 |
| Client | Mobile-first web |
| Launch | Single residence in use; multi-residence-ready data model |
| Platform | **Netlify** hosting + **Netlify Database** (Postgres); see RFCs |
| Related | Master RFC: [`../rfc/2026-08-01-residence-problem-tracker.md`](../rfc/2026-08-01-residence-problem-tracker.md); decisions under [`../adr/`](../adr/) |

## 1. Summary

Residents of a residence need a simple way to raise problems (maintenance, facilities, safety, noise, etc.) to management and see clear status as work progresses. Management needs a single queue to acknowledge, update, and close those problems. This product is a mobile-first web tracker for one residence at launch, designed so additional residences can be added later without rewriting the core model.

**Platform constraint (MVP):** ship on Netlify with application data in Netlify Database (managed Postgres). Auth is passwordless magic link with sessions in that same database — not a separate Supabase project. Details in [`../rfc/2026-08-01-system-architecture.md`](../rfc/2026-08-01-system-architecture.md) and [`../rfc/2026-08-01-netlify-database.md`](../rfc/2026-08-01-netlify-database.md).

## 2. Goals and non-goals

### Goals

- Let a resident raise a problem in under a minute on a phone.
- Let a resident always know the current status of their problems.
- Let management see all open problems for a residence and update status.
- Allow both sides to comment on a problem for clarification.
- Scope every domain record by `residenceId` so multi-residence is a product step, not a redesign.

### Non-goals (MVP)

- Native iOS/Android apps
- Payments, billing, or rent collection
- Push / email / SMS notifications (list as follow-up)
- Photo / file attachments (list as follow-up)
- Public / anonymous reporting without an account
- Full SaaS: billing orgs, self-serve residence onboarding, staff RBAC beyond resident/manager
- Analytics dashboards beyond basic list filters
- Supabase (or other second BaaS) for database/auth — use Netlify Database + magic-link auth instead

## 3. Personas and roles

| Role | Who | Can |
|------|-----|-----|
| **Resident** | Person living in a unit of the residence | Create problems; view **own** problems; comment on own problems; see status |
| **Manager** | Residence management / ops | View **all** problems for the residence; change status; comment on any problem |

Rules:

- Access requires a `Membership` linking `User` + `Residence` + `role`.
- A user may hold both roles over time; effective permissions are the union of memberships for the active residence.
- Launch UI assumes one active residence; the model still allows multiple memberships.

## 4. User stories

1. **Raise** — As a resident, I raise a problem with title, description, optional unit/location and category, so management can act.
2. **Track mine** — As a resident, I see a list of my problems with current status and open one for detail + comments.
3. **Manager queue** — As a manager, I see all problems for the residence, filter by status, and open any problem.
4. **Update status** — As a manager, I move a problem through the status model so residents see progress.
5. **Discuss** — As a resident or manager, I comment on a problem so questions and updates are in one thread.
6. **Know it’s done** — As a resident, I see when a problem is resolved or closed without chasing management offline.

## 5. Status model

Allowed statuses:

`submitted` → `acknowledged` → `in_progress` → `resolved` → `closed`

Also: `rejected` (terminal; from `submitted` or `acknowledged` only).

| Transition | Who | Notes |
|------------|-----|-------|
| → `acknowledged` | Manager | Confirms receipt |
| → `in_progress` | Manager | Work started |
| → `resolved` | Manager | Fix claimed done; resident can still comment |
| → `closed` | Manager | Done; default: no further status changes |
| → `rejected` | Manager | Not actionable / duplicate / out of scope; require a comment |

**MVP reopen:** Manager may move `resolved` → `in_progress` or `closed` → `in_progress` if the issue returns. Residents cannot change status.

Invalid jumps (e.g. `submitted` → `closed`) are rejected by the API/UI.

## 6. Functional requirements

### 6.1 Auth and membership (MVP)

- User can sign in (mechanism TBD — open question; assume account exists).
- Every request is authorized against membership for a `residenceId`.
- Resident without membership cannot create or list problems.
- Seed/admin path may create the first residence and first manager (ops, not self-serve).

### 6.2 Problems

- **Create (resident):** title (required), description (required), optional `unit` / location, optional category (enum: `maintenance`, `facilities`, `safety`, `noise`, `other`).
- **List (resident):** own problems only; show status, title, updatedAt; newest first.
- **List (manager):** all problems for active residence; filter by status; newest first.
- **Detail:** status, metadata, comment thread, timestamps (`createdAt`, `updatedAt`, `statusChangedAt`).
- **Status update (manager only):** only allowed transitions; record actor and timestamp.

### 6.3 Comments

- Resident: comment on own problems (including `resolved`; not on `closed` / `rejected` unless manager reopens).
- Manager: comment on any problem in the residence.
- MVP: all comments are visible to both sides (no private manager notes).
- No edit/delete in MVP (append-only); defer to later if needed.

### 6.4 Mobile-first UX

Screens:

1. **Home / list** — role-appropriate problem list + FAB or primary “New problem”
2. **New problem** — short form, large tap targets, submit
3. **Problem detail** — status badge, body, comment list, comment composer; manager also gets status control
4. **Manager filters** — status chips or select on list

Empty states: “No problems yet” / “Nothing in this filter”.

## 7. Conceptual data model

```
Residence
  id, name, createdAt

User
  id, displayName, email, createdAt

Membership
  id, userId, residenceId, role (resident | manager), createdAt
  unique (userId, residenceId, role)  -- or single role per pair; see open questions

Problem
  id, residenceId, reporterUserId, title, description,
  unit?, category?, status, createdAt, updatedAt, statusChangedAt

Comment
  id, problemId, residenceId, authorUserId, body, createdAt
```

Invariants:

- `Problem.residenceId` and `Comment.residenceId` must match the problem’s residence.
- Reads/writes always filter by `residenceId` from the membership context (never trust client-only IDs without check).

## 8. Multi-residence readiness

| Now (MVP) | Later |
|-----------|--------|
| `residenceId` on Problem, Comment, Membership | Residence switcher in UI |
| One active residence in session / config | User with many memberships |
| Ops-seeded residence + users | Invites, join codes, self-serve onboarding |
| Roles: resident, manager | Finer staff roles, per-building teams |

Do **not** build global problem lists without a residence scope.

## 9. Edge cases

Format: **Trigger → Expected → MVP handling** (`support` | `defer` | `reject`).

### 9.1 Auth and membership

| # | Trigger | Expected | MVP |
|---|---------|----------|-----|
| E1 | Signed-in user with no membership | No residence data; clear “not a member” state; cannot create problems | **support** |
| E2 | Resident calls manager-only status API | 403; status unchanged | **support** |
| E3 | Same user is resident and manager for one residence | Can create as resident; can update status as manager; sees manager queue | **support** (union of permissions) |
| E4 | Membership removed while problems still open | User loses access to list/detail; problems remain for managers; reporter display shows historical name/id | **support** (keep problems; deny access) |
| E5 | Manager for residence A, resident for B | Actions scoped to active residence only; no cross-leak | **support** in model; **defer** multi-residence UI |

### 9.2 Problem lifecycle

| # | Trigger | Expected | MVP |
|---|---------|----------|-----|
| E6 | Invalid status jump (`submitted` → `closed`) | Reject with validation error | **support** |
| E7 | `rejected` without comment | Reject; require comment explaining why | **support** |
| E8 | Reopen after `resolved` / `closed` | Manager only; back to `in_progress`; status history via timestamps + comments | **support** (simple reopen; no full audit log) |
| E9 | Duplicate report of same physical issue | Allowed as separate problems in MVP; manager may `reject` with “duplicate of #id” | **support** (manual); **defer** merge/link |
| E10 | Empty title/description or whitespace-only | Client + server validation; do not create | **support** |
| E11 | Extremely long description | Cap length (e.g. 5k chars); reject over cap | **support** |
| E12 | Spam / repeated submits | Basic rate limit per user (e.g. N/hour); **defer** abuse tooling | **support** light limit; **defer** moderation |

### 9.3 Visibility and tenancy

| # | Trigger | Expected | MVP |
|---|---------|----------|-----|
| E13 | Resident requests another resident’s problem by ID | 404 or 403 (do not confirm existence across users) | **support** |
| E14 | Resident/manager guesses ID from another residence | 404/403; no cross-residence read | **support** |
| E15 | Anonymous / unauthenticated access to detail | Deny | **support** |
| E16 | Manager wants private notes residents must not see | Separate note type | **defer** (all comments shared in MVP) |

### 9.4 Comments

| # | Trigger | Expected | MVP |
|---|---------|----------|-----|
| E17 | Comment on `closed` or `rejected` | Resident blocked; manager may comment or must reopen first — **choose:** manager can comment without reopen | **support** (manager yes, resident no) |
| E18 | Edit or delete comment | Not available | **reject** for MVP |
| E19 | Empty comment body | Reject | **support** |
| E20 | Author account deleted | Show “Former user” or retain displayName snapshot on comment | **defer** soft-delete polish; **support** keep `authorUserId` |

### 9.5 Concurrency

| # | Trigger | Expected | MVP |
|---|---------|----------|-----|
| E21 | Two managers change status at once | Last write wins on status; both allowed if each transition valid from the status they read — prefer: reload + validate against current status; second fails if transition no longer valid | **support** (optimistic check on current status) |
| E22 | Resident comments while status changes | Comment still attaches; detail shows latest status on refresh | **support** |

### 9.6 Multi-residence and deletion

| # | Trigger | Expected | MVP |
|---|---------|----------|-----|
| E23 | User has memberships in two residences | Data model allows; UI uses one active residence | **support** model; **defer** switcher |
| E24 | Residence deleted | Block hard delete if problems exist; or soft-delete residence | **defer** admin delete; **reject** silent orphan hard-delete in MVP |
| E25 | Problem created with mismatched `residenceId` vs membership | Reject | **support** |

### 9.7 Mobile and ops

| # | Trigger | Expected | MVP |
|---|---------|----------|-----|
| E26 | Submit fails (offline / network) | Show error; do not claim success; allow retry | **support** |
| E27 | Unit / room omitted | Allowed; managers may ask via comment | **support** |
| E28 | Timezone display | Store UTC; show local device time | **support** |
| E29 | Deep link to problem while logged out | After login, land on problem if authorized | **defer** |

### 9.8 Edge-case → requirements mapping

Must implement in MVP: **E1–E14, E17, E19, E21–E23, E25–E28**.

Explicitly deferred: **E9 merge, E12 heavy moderation, E16 private notes, E18 edit/delete, E20 display polish, E24 residence delete, E29 deep links**.

## 10. Success metrics

| Metric | Target (directional) |
|--------|----------------------|
| Time for resident to create a problem | Under 1 minute once logged in |
| Problems acknowledged by management | Median time-to-`acknowledged` tracked; improve over baseline (WhatsApp/verbal) |
| Resident clarity | Resident can answer “what’s the status?” from the app without contacting management |
| Manager adoption | Managers use the queue as primary intake for tracked issues |

## 11. Milestones

1. **MVP** — Auth + membership seed; create/list/detail; status transitions; comments; mobile-first UI; tenancy checks (edge cases in §9.8).
2. **Trust & clarity** — Status history timeline; categories polish; light rate limits.
3. **Multi-residence** — Switcher, invites; RFCs as needed.
4. **Reach** — Notifications; attachments; optional private manager notes.

## 12. Open questions

| # | Question | Notes |
|---|----------|-------|
| Q1 | Auth provider? | Proposed in [`auth-and-membership`](../rfc/2026-08-01-auth-and-membership.md): magic link (Better Auth / Auth.js) on Netlify Database |
| Q2 | One role per (user, residence) or multiple rows? | Proposed in same RFC: one role; `manager` ⊇ resident |
| Q3 | Categories list final? | Start with enum in §6.2 |
| Q4 | Attachments in MVP after all? | Currently non-goal; revisit if management requires photos |
| Q5 | Notifications channel? | Email vs push — post-MVP RFC |
| Q6 | Should residents see all building-wide problems? | MVP = own only; transparency mode is a product decision |

## 13. Recommended approach

**Lean ticket product** (not spreadsheet ops, not full SaaS): mobile-first web; `resident` / `manager`; status machine; comments; `residenceId` on all domain rows. Matches launch constraint (one residence) and leaves a clean path to multi-residence via membership + UI, documented later as RFC/ADR.
