# RFC: Problem Comments

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-08-01 |
| PRD | [`../prd/residence-problem-tracker.md`](../prd/residence-problem-tracker.md) (§6.3, E7, E16–E20, E22) |
| Related | [`problem-domain`](2026-08-01-problem-domain.md), [`problem-status-lifecycle`](2026-08-01-problem-status-lifecycle.md), [`auth-and-membership`](2026-08-01-auth-and-membership.md) |

## 1. Summary

Define the **append-only comment thread** on a problem: who may post, visibility (all shared), body validation, and interaction with `closed` / `rejected` / status changes. No private manager notes and no edit/delete in MVP.

## 2. Motivation

Comments are the clarification channel between residents and management. Rules must be unambiguous so the UI and server functions do not diverge (especially around terminal statuses and reject-requires-comment).

## 3. Proposal

### 3.1 Entity

Table `comments`:

| Field | Type | Rules |
|-------|------|--------|
| `id` | uuid | PK |
| `problem_id` | uuid | NOT NULL; FK → `problems` |
| `residence_id` | uuid | NOT NULL; denormalized; must equal problem’s residence |
| `author_user_id` | uuid | NOT NULL; `auth.uid()` on insert |
| `body` | text | Required; trim; non-empty; max **2000** chars |
| `created_at` | timestamptz | UTC |

No `updated_at`. No soft-delete. No “internal” flag (E16 deferred).

### 3.2 Visibility

- Every comment on a problem is visible to anyone who can **detail** that problem.
- Residents see manager comments; managers see resident comments.
- No private notes in MVP.

### 3.3 Who may create

| Actor | Rule |
|-------|------|
| Resident | May comment on **own** problems only, and only if status ∉ {`closed`, `rejected`} |
| Manager | May comment on **any** problem in the residence, including `closed` and `rejected` (E17) |
| Non-member / other residence | Deny (404/403 consistent with problem detail) |

When status is `resolved`, residents **may** still comment (PRD) — e.g. “still broken”.

### 3.4 Reject-linked comment (E7)

When status moves to `rejected`, the lifecycle RFC requires a comment body in the same request. Implementation options (pick one):

1. **Preferred:** `updateProblemStatus` inserts the comment inside the same DB transaction.
2. Alternate: dedicated `rejectProblem({ problemId, commentBody })` wrapper that only allows → `rejected`.

UI: rejecting always shows a required comment field.

### 3.5 Append-only

| Action | MVP |
|--------|-----|
| Create | Support |
| Edit | **Reject** (E18) |
| Delete | **Reject** (E18) |
| Reactions / mentions | Defer |

### 3.6 Validation

| Rule | Behavior |
|------|----------|
| Empty / whitespace-only body | 400 (E19) |
| Body > 2000 chars | 400 |
| Problem not visible to actor | 404 |
| Resident on `closed`/`rejected` | 403 |
| Concurrent status change while commenting | Comment still inserts if create rules pass at write time (E22); client refreshes status |

### 3.7 Author display

- Show `profiles.display_name` (or email local-part) next to each comment.
- If user later deleted: keep `author_user_id`; polish “Former user” label deferred (E20). Optional later: snapshot `author_display_name` at insert — **defer** unless cheap.

### 3.8 Ordering and API

- Detail returns comments **oldest → newest** (conversation order).
- Server function: `addComment({ problemId, body })`.
- After add: bump parent problem `updated_at` so list “recent activity” moves up.

### 3.9 Rate limit

Light per-user comment rate (e.g. 60/hour) to blunt spam; defer moderation tooling.

## 4. Alternatives considered

| Option | Verdict |
|--------|---------|
| Private manager notes in MVP | Defer (E16) — separate type later |
| Allow resident comment on `closed` | Reject — forces reopen path for real discussion |
| Require reopen before manager comments on `closed` | Reject — managers may leave closing notes |
| Threaded replies (parent_id) | Defer — flat list only |
| Markdown | Defer — plain text |

## 5. Open questions

| # | Question | Suggested default |
|---|----------|-------------------|
| O1 | Comment max length 2000 vs 5000? | **2000** |
| O2 | Snapshot display name on insert? | **No** for MVP |
| O3 | Notify other party on new comment? | **No** — notifications RFC later |

## 6. Decision

_Filled when accepted / rejected / deferred._

| Field | Value |
|-------|-------|
| Outcome | |
| Date | |
| ADR | |
