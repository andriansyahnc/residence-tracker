> **Superseded as source of truth** by [`2026-08-01-residence-problem-tracker.md`](2026-08-01-residence-problem-tracker.md) (master RFC). Kept as a topic extract.

# RFC: Problem Tracker Validation & Edge Cases

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-08-01 |
| PRD | [`../prd/residence-problem-tracker.md`](../prd/residence-problem-tracker.md) (§9, especially §9.8) |
| Related | All problem RFCs + [`auth-and-membership`](2026-08-01-auth-and-membership.md) |

## 1. Summary

Consolidate **MVP must-implement edge cases** for the problem tracker into a checklist mapped to owning RFCs, with concrete HTTP/UX outcomes. This is the acceptance gate before calling MVP “done.”

## 2. Motivation

PRD §9 is long; implementers need a single pass/fail matrix so nothing in §9.8 is missed across domain, status, comments, auth, and UX.

## 3. Proposal

### 3.1 Must implement (PRD §9.8)

| ID | Trigger | Expected | Owning RFC |
|----|---------|----------|------------|
| E1 | Signed-in, no membership | Not-a-member UI; no create | auth, ux |
| E2 | Resident hits status API | 403; status unchanged | status, auth |
| E3 | Manager role (includes create) | Can file + manage queue | auth |
| E4 | Membership removed | Lose access; problems remain | auth, domain |
| E5 | Cross-residence roles | Scoped to active residence | auth (UI switcher deferred) |
| E6 | Invalid status jump | 400 | status |
| E7 | Reject without comment | 400 | status, comments |
| E8 | Reopen resolved/closed | Manager → `in_progress` | status |
| E9 | Duplicate physical issue | Separate problems OK; manual reject | domain, status |
| E10 | Empty title/description | Client + server reject | domain |
| E11 | Description too long | Cap 5000; reject | domain |
| E12 | Spam creates | Light rate limit | domain |
| E13 | Resident reads others’ problem | 404 | domain, auth |
| E14 | Cross-residence ID guess | 404 | domain, auth |
| E17 | Comment on closed/rejected | Resident no; manager yes | comments |
| E19 | Empty comment | 400 | comments |
| E21 | Concurrent status updates | 409 if expected status stale | status |
| E22 | Comment during status change | Comment OK; refresh status | comments, status |
| E23 | Multi membership model | Model OK; one active in UI | auth |
| E25 | Mismatched residence on create | Reject | domain |
| E26 | Offline submit failure | Error + retry; no false success | ux |
| E27 | Unit omitted | Allowed | domain |
| E28 | Timezone | UTC store; local display | domain, ux |

### 3.2 Explicitly deferred / rejected

| ID | Handling |
|----|----------|
| E9 merge/link | Defer |
| E12 heavy moderation | Defer |
| E16 private notes | Defer |
| E18 edit/delete comment | Reject MVP |
| E20 former-user polish | Defer (keep author id) |
| E24 residence delete | Defer; no silent hard-delete |
| E29 login return deep link | Defer |

### 3.3 Cross-cutting validation constants

| Field | Min | Max |
|-------|-----|-----|
| Problem title | 1 (trimmed) | 200 |
| Problem description | 1 (trimmed) | 5000 |
| Unit | 0 | 100 |
| Comment body | 1 (trimmed) | 2000 |
| Creates / user / hour | — | 10 (tunable) |
| Comments / user / hour | — | 60 (tunable) |

### 3.4 Error shape (server → client)

Consistent JSON for server functions / routes:

```
{ error: { code: 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'RATE_LIMITED', message: string, fields?: Record<string, string> } }
```

Map to UI per UX RFC. Never leak whether another resident’s problem exists (use NOT_FOUND).

### 3.5 Test checklist (MVP)

Minimum automated or scripted cases before ship:

1. Resident create → list own → detail.
2. Resident cannot detail peer’s problem (404).
3. Manager lists all; filters by status.
4. Each allowed transition succeeds; one illegal jump fails.
5. Reject without comment fails; with comment succeeds and comment visible.
6. Reopen `closed` → `in_progress`.
7. Resident cannot comment on `closed`; manager can.
8. Stale `expectedStatus` → 409.
9. Non-member signed-in cannot create.
10. Create with only whitespace title fails.

## 4. Alternatives considered

| Option | Verdict |
|--------|---------|
| Keep edge cases only in PRD | Reject — too easy to miss in implementation |
| Full audit log for every edge | Defer |

## 5. Open questions

| # | Question | Suggested default |
|---|----------|-------------------|
| O1 | Exact rate-limit numbers | Start with §3.3; tune after pilot |
| O2 | 403 vs 404 for peer problems | **404** (already chosen) |

## 6. Decision

_Filled when accepted / rejected / deferred._

| Field | Value |
|-------|-------|
| Outcome | |
| Date | |
| ADR | |
