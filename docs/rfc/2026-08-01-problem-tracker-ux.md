> **Superseded as source of truth** by [`2026-08-01-residence-problem-tracker.md`](2026-08-01-residence-problem-tracker.md) (master RFC). Kept as a topic extract.

# RFC: Problem Tracker Mobile UX

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-08-01 |
| PRD | [`../prd/residence-problem-tracker.md`](../prd/residence-problem-tracker.md) (§6.4, E1, E26–E28) |
| Related | [`problem-domain`](2026-08-01-problem-domain.md), [`problem-status-lifecycle`](2026-08-01-problem-status-lifecycle.md), [`problem-comments`](2026-08-01-problem-comments.md), [`system-architecture`](2026-08-01-system-architecture.md) |

## 1. Summary

Specify the **MVP screens and interaction patterns** for the residence problem tracker: list, create, detail (with comments + manager status), empty/error states, and mobile ergonomics. Visual brand is deliberately boring (shadcn defaults); this RFC is structure and behavior, not aesthetics.

## 2. Motivation

PRD success depends on “under a minute to raise” and “always know status” on a phone. Without a screen contract, implementation drifts into desktop-first or cluttered dashboards.

## 3. Proposal

### 3.1 Information architecture

| Route (conceptual) | Who | Purpose |
|--------------------|-----|---------|
| `/login` | Anyone | Magic-link email entry |
| `/` or `/problems` | Member | Role-appropriate list |
| `/problems/new` | Member with create | Create form |
| `/problems/$problemId` | Authorized | Detail + comments (+ status for manager) |
| `/not-a-member` | Signed-in, no membership | Clear empty state (E1) |

No marketing site required for MVP. No desktop sidebar dashboard.

### 3.2 Screen: Home / list

**Resident**

- Title: “My problems” (or residence name).
- Rows: status chip · title · relative `updated_at`.
- Primary action: sticky bottom or FAB **“New problem”**.
- Empty: “No problems yet” + CTA to create.

**Manager**

- Title: residence name + “All problems”.
- Same rows; optional category/unit as secondary line.
- Horizontal **status filter chips**: All | Submitted | Acknowledged | In progress | Resolved | Closed | Rejected.
- Same **“New problem”** affordance (managers can file too).
- Empty filter: “Nothing in this filter”.

Tap row → detail. Pull-to-refresh optional; simple reload on focus is enough for MVP.

### 3.3 Screen: New problem

Single short form, large tap targets:

1. Title (required)
2. Description (required, multiline)
3. Unit / location (optional)
4. Category (optional select)
5. Submit

Behavior:

- Disable submit while request in flight.
- On network failure: show error; **do not** navigate away or claim success; allow retry (E26).
- On success: navigate to new problem detail (or list with toast — prefer **detail**).

### 3.4 Screen: Problem detail

Top → bottom:

1. Status badge (large, readable)
2. Title + meta (category, unit, created/updated local time)
3. Description body
4. **Manager only:** status control (select or button group of *legal* next statuses from lifecycle RFC). Reject flow opens comment-required sheet/field.
5. Comments list (oldest → newest)
6. Comment composer (hidden/disabled for residents when `closed`/`rejected`)

Resident closed/rejected: show read-only note “This problem is closed/rejected” without composer.

### 3.5 Sign-in and membership gates

- Unauthenticated deep visit → login (return-to-problem **deferred** per E29; land on list after login for MVP).
- Authenticated, no membership → dedicated not-a-member copy; no create FAB.

### 3.6 Feedback patterns

| Event | UI |
|-------|-----|
| Validation error | Inline under field |
| 403/404 on detail | Simple “Problem not found” |
| 409 on status | Toast/banner “Status changed — refreshed”; reload detail |
| Offline submit | Error + retry (E26) |
| Success status change | Update badge in place; clear pending control |

### 3.7 Accessibility / mobile baseline

- Minimum tap target ~44px.
- Status not conveyed by color alone (include text label).
- `inputmode` / autocomplete sensible on email login.
- Safe-area padding for notched phones on sticky CTA.

### 3.8 What not to put in the first viewport (list)

No stats strip, no charts, no address block, no multi-widget dashboard. One job: scan problems and act.

## 4. Alternatives considered

| Option | Verdict |
|--------|---------|
| Separate manager-only app/URL | Reject — one app, role-based UI |
| Desktop table as primary | Reject — mobile-first web |
| Realtime live updates | Defer — refresh on navigation |
| Wizard multi-step create | Reject — one screen form |
| Bottom tab bar (Home / New / Settings) | Optional; FAB + stack is enough for MVP |

## 5. Open questions

| # | Question | Suggested default |
|---|----------|-------------------|
| O1 | FAB vs bottom primary button for New? | **Sticky bottom bar** (more discoverable than FAB for non-power users) |
| O2 | Show category color coding? | **No** — text chip only |
| O3 | Confirm dialog before Close/Reject? | **Yes** for Reject (comment); soft confirm for Close |

## 6. Decision

_Filled when accepted / rejected / deferred._

| Field | Value |
|-------|-------|
| Outcome | |
| Date | |
| ADR | |
