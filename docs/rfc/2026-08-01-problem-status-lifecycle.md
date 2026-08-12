> **Superseded as source of truth** by [`2026-08-01-residence-problem-tracker.md`](2026-08-01-residence-problem-tracker.md) (master RFC). Kept as a topic extract.

# RFC: Problem Status Lifecycle

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-08-01 |
| PRD | [`../prd/residence-problem-tracker.md`](../prd/residence-problem-tracker.md) (§5, §6.2 status, E2, E6–E8, E21) |
| Related | [`problem-domain`](2026-08-01-problem-domain.md), [`problem-comments`](2026-08-01-problem-comments.md), [`auth-and-membership`](2026-08-01-auth-and-membership.md) |

## 1. Summary

Lock the **status state machine** for problems: allowed values, who may transition, reopen rules, reject-requires-comment, and optimistic concurrency. Residents never change status.

## 2. Motivation

Status is how residents know progress without chasing management. Invalid jumps and races must be rejected consistently in UI and server (single shared module).

## 3. Proposal

### 3.1 Status values

```
submitted | acknowledged | in_progress | resolved | closed | rejected
```

Happy path:

```
submitted → acknowledged → in_progress → resolved → closed
```

Side path:

```
submitted → rejected
acknowledged → rejected
```

Reopen (manager only):

```
resolved → in_progress
closed → in_progress
```

### 3.2 Transition table (authoritative)

| From | To | Who | Extra rules |
|------|-----|-----|-------------|
| `submitted` | `acknowledged` | Manager | — |
| `submitted` | `in_progress` | Manager | Skip ack if work starts immediately — **allowed** |
| `submitted` | `rejected` | Manager | **Require comment** in same request (E7) |
| `acknowledged` | `in_progress` | Manager | — |
| `acknowledged` | `rejected` | Manager | **Require comment** |
| `in_progress` | `resolved` | Manager | — |
| `resolved` | `closed` | Manager | — |
| `resolved` | `in_progress` | Manager | Reopen (E8) |
| `closed` | `in_progress` | Manager | Reopen (E8) |

**Explicitly forbidden (examples):**

- Any transition by resident → **403** (E2)
- `submitted` → `closed` / `resolved` → **400** (E6)
- `rejected` → anything → **400** (terminal in MVP; no reopen from rejected — manager files guidance via comment on a new problem or we add later)
- `closed` → `resolved` / `acknowledged` → **400**
- `in_progress` → `acknowledged` / `submitted` → **400**

### 3.3 Rejected is terminal (MVP)

- No transition out of `rejected` in MVP.
- Duplicate/out-of-scope handling: reject + comment e.g. “duplicate of &lt;id&gt;” (E9).
- If product later needs reopen-from-rejected, add via new RFC/ADR.

### 3.4 Side effects on successful transition

1. Set `status` to target.
2. Set `status_changed_at = now()` (UTC).
3. Bump `updated_at`.
4. If target is `rejected`: insert the required comment in the **same transaction** as the status update (or fail both).
5. Optional system-style comment for other transitions: **defer** — managers can comment manually; UI shows new status badge.

No full audit/history table in MVP (E8). History = `status_changed_at` + human comments.

### 3.5 API

```
updateProblemStatus({
  problemId,
  expectedStatus,   // status client believes is current
  nextStatus,
  commentBody?      // required when nextStatus === 'rejected'
})
```

| Check order | Failure |
|-------------|---------|
| Authenticated + manager for problem’s residence | 403 |
| Problem exists in active residence | 404 |
| `expectedStatus === problem.status` | **409** conflict — reload (E21) |
| `(from, to)` in allow-list | 400 |
| `rejected` ⇒ non-empty trimmed `commentBody` | 400 |
| Apply update + optional comment atomically | 500 only on infra |

### 3.6 Concurrency (E21)

Optimistic locking via `expectedStatus` (not a version column for MVP):

- Manager A and B both see `submitted`.
- A → `acknowledged` succeeds.
- B → `acknowledged` with `expectedStatus: submitted` fails **409**; UI refreshes and retries if still valid.

Do **not** last-write-wins across invalid intermediate states.

### 3.7 Shared module

One pure function used by server and UI:

```
canTransition(from, to, role) → { ok: true } | { ok: false, reason }
```

UI disables illegal status options; server remains source of truth.

### 3.8 Who sees what after change

- Resident sees new status on next list/detail load (no realtime required in MVP).
- Commenting while status changes: allowed per comments RFC; detail shows latest status on refresh (E22).

## 4. Alternatives considered

| Option | Verdict |
|--------|---------|
| Allow `submitted` → `resolved` shortcut | Reject — too opaque for residents |
| Require every step (no skip ack) | Reject — allow `submitted` → `in_progress` for speed |
| Full status history table | Defer — timestamps + comments enough for MVP |
| Resident confirms before `closed` | Defer — manager closes; resident can comment while `resolved` |
| Reopen to `submitted` | Reject — reopen to `in_progress` only |

## 5. Open questions

| # | Question | Suggested default |
|---|----------|-------------------|
| O1 | Allow `acknowledged` → `resolved` skip `in_progress`? | **No** — keep work-started visible |
| O2 | Auto-comment on every status change? | **No** for MVP |
| O3 | Reopen from `rejected`? | **No** for MVP |
| O4 | Record `status_changed_by` user id? | **Yes** — cheap column; helps managers later |

## 6. Decision

_Filled when accepted / rejected / deferred._

| Field | Value |
|-------|-------|
| Outcome | |
| Date | |
| ADR | |
