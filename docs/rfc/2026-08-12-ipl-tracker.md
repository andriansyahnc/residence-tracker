# RFC: IPL Tracker (delta)

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-08-12 |
| Design | [`../superpowers/specs/2026-08-12-ipl-tracker-design.md`](../superpowers/specs/2026-08-12-ipl-tracker-design.md) |
| Parent | [`2026-08-01-residence-problem-tracker.md`](2026-08-01-residence-problem-tracker.md) (stack, auth session, tenancy patterns unchanged unless noted) |

This is the **single design RFC** for the IPL (iuran pengelolaan lingkungan) MVP add-on: domain, roles delta, flows, report/PDF, PWA, and acceptance focus. It does **not** replace the problem-tracker master RFC.

---

## Table of contents

1. [Summary](#1-summary)
2. [Motivation](#2-motivation)
3. [Scope relative to parent](#3-scope-relative-to-parent)
4. [Roles delta](#4-roles-delta)
5. [Management group & tenancy](#5-management-group--tenancy)
6. [Domain model](#6-domain-model)
7. [Flows & rules](#7-flows--rules)
8. [Monthly report & PDF](#8-monthly-report--pdf)
9. [UI](#9-ui)
10. [Technical fit](#10-technical-fit)
11. [Testing focus](#11-testing-focus)
12. [Alternatives considered](#12-alternatives-considered)
13. [Open questions](#13-open-questions)
14. [Decision](#14-decision)

---

## 1. Summary

Add an **IPL module** beside the existing problem tracker in the same TanStack Start / Netlify app:

| Piece | Choice |
|-------|--------|
| Product language | Bahasa Indonesia (UI) |
| Shape | Lean add-on — shared auth, membership, residences |
| Formula | `ipl_due = luas_tanah_m2 × fee_per_m2` (IDR); amount snapshotted on due creation |
| Residences | Two residences under one **management group**; **one combined** monthly money report |
| Proofs | Resident uploads screenshot; staff verify/reject (**no OCR** in MVP) |
| Staff | Manager + new role **Accountant** (same IPL powers for MVP) |
| Deliverable | Web report + server-generated PDF; installable **PWA** |
| PDF | **`@react-pdf/renderer`** (server `renderToBuffer`) |
| Files | **Netlify Blobs** site store (`getStore`) |
| PWA | **`vite-plugin-pwa`** |

**Out of MVP:** OCR, late fees, reminders, push/email, resident-submitted expenses, per-residence expense ledgers, replacing the problem tracker.

---

## 2. Motivation

Problem tracker covers issues; residents and staff still need a shared place for **monthly IPL dues, payment proof, shared expenses, and one money report** across the two residences under the same management.

Design is approved for planning: [`2026-08-12-ipl-tracker-design.md`](../superpowers/specs/2026-08-12-ipl-tracker-design.md).

---

## 3. Scope relative to parent

| Inherited from parent (unchanged) | Delta in this RFC |
|-----------------------------------|-------------------|
| TanStack Start, Netlify host/DB, Drizzle, magic-link session | New IPL tables + server functions |
| Server-only DB; membership-gated fns | `accountant` membership role |
| `residence_id` tenancy on residence-scoped rows | `management_group` for combined report scope |
| Problem create/list/status/comments | Unit / IPL / expense / report domains |
| Mobile-first web | PWA installability; file uploads; PDF |

Problem-tracker capabilities stay as today. This RFC does not expand problem attachments or notifications.

---

## 4. Roles delta

Parent: `role ∈ { resident, manager }` per `(user_id, residence_id)`.

**Change:** `role ∈ { resident, manager, accountant }`.

| Role | Problem tracker | IPL |
|------|-----------------|-----|
| **Resident** | As parent | View own unit due; upload proof; request luas change; view combined report |
| **Manager** | As parent | All IPL staff powers |
| **Accountant** | **Resident-equivalent only** (no manager queue/status) unless also manager | Same IPL staff powers as Manager for MVP |

**IPL staff powers:** set/import unit `luas_tanah_m2`; set `fee_per_m2` per residence; verify/reject proofs; add/edit expenses; edit report `keterangan`; generate PDF.

```
canIplStaff     = role in (manager, accountant)
canVerifyProof  = canIplStaff
canManageExpense = canIplStaff
canEditKeterangan = canIplStaff
canManageProblems = role == manager   // unchanged; accountant does not get this
```

Membership remains required; login alone does not grant IPL access.

---

## 5. Management group & tenancy

MVP manages **two known residences** as one reporting scope.

| Decision | Choice |
|----------|--------|
| Link model | Explicit `management_groups` + `management_group_residences` (group ↔ residence) |
| Report scope | One `MonthlyReport` / `IplPeriod` per **management group**, not per residence |
| Seed | Ops seed links the two pilot residences to one group |

Residence-scoped rows keep `residence_id` (units, rates, dues, proofs). Shared rows use `management_group_id` (periods, expenses, monthly reports).

Active residence for problem UX stays as parent. IPL report views resolve the user's membership → residence(s) → management group; members of either linked residence see the **same** combined report.

---

## 6. Domain model

### 6.1 Entities

| Entity | Scope | Purpose |
|--------|-------|---------|
| **Unit** | `residence_id` | Unit label; `luas_tanah_m2`; linked to resident membership(s) |
| **IplRate** | `residence_id` | Current `fee_per_m2` (IDR); staff-editable |
| **IplPeriod** | `management_group_id` | Calendar month key e.g. `2026-08` |
| **IplDue** | unit + period | Amount = luas × fee **snapshotted** at generation |
| **IplPaymentProof** | due | Screenshot; `pending` \| `verified` \| `rejected` |
| **LuasChangeRequest** | unit | Resident proposes new luas; staff approve/reject |
| **Expense** | `management_group_id` + `period_id` | Shared expense line on the combined report |
| **MonthlyReport** | `period_id` | Editable `keterangan` only — totals are **computed**, not stored |

**Money storage:** all IDR amounts are `bigint` integer rupiah (no float / numeric money). Luas is `numeric(10,2)` m². Snapshots on dues are immutable after insert.

### 6.2 Tables (locked schema)

Conventions: `uuid` PK (`gen_random_uuid()`), `timestamptz` UTC, FKs `ON DELETE RESTRICT` unless noted, app-enforced tenancy in server fns.

#### `management_groups`

| Column | Type | Rules |
|--------|------|--------|
| `id` | uuid PK | |
| `name` | text | required; trim; max 200 |
| `created_at` | timestamptz | default now |

#### `management_group_residences`

| Column | Type | Rules |
|--------|------|--------|
| `management_group_id` | uuid FK → management_groups | |
| `residence_id` | uuid FK → residences | **UNIQUE** (a residence belongs to at most one group) |
| `sort_order` | int | report label order (A=1, B=2); UNIQUE `(management_group_id, sort_order)` |
| `created_at` | timestamptz | |

PK: `(management_group_id, residence_id)`.

#### `units`

| Column | Type | Rules |
|--------|------|--------|
| `id` | uuid PK | |
| `residence_id` | uuid FK → residences | indexed |
| `label` | text | required; trim; max 50; **UNIQUE** `(residence_id, label)` |
| `luas_tanah_m2` | numeric(10,2) | `> 0` |
| `created_at` / `updated_at` | timestamptz | |

#### `unit_memberships`

Links a residence membership to a unit (who sees/pays that unit’s due).

| Column | Type | Rules |
|--------|------|--------|
| `id` | uuid PK | |
| `unit_id` | uuid FK → units | |
| `membership_id` | uuid FK → memberships | **UNIQUE** `(unit_id, membership_id)` |
| `created_at` | timestamptz | |

App invariant: `membership.residence_id == unit.residence_id` (check in server fn / optional DB trigger).

Index: `(membership_id)` for “my units” lookup.

#### `ipl_rates`

One **current** rate row per residence (overwrite on edit; no history table in MVP).

| Column | Type | Rules |
|--------|------|--------|
| `residence_id` | uuid PK/FK → residences | one row per residence |
| `fee_per_m2_idr` | bigint | `> 0` |
| `updated_at` | timestamptz | |
| `updated_by_user_id` | uuid FK → user | |

#### `ipl_periods`

| Column | Type | Rules |
|--------|------|--------|
| `id` | uuid PK | |
| `management_group_id` | uuid FK → management_groups | |
| `year_month` | char(7) | `YYYY-MM`; CHECK regex `^\d{4}-(0[1-9]|1[0-2])$` |
| `status` | text | `open` \| `closed` (MVP: `closed` blocks new proofs/expenses edits if we enforce; default open) |
| `opened_at` | timestamptz | |
| `opened_by_user_id` | uuid FK → user | |

**UNIQUE** `(management_group_id, year_month)`.

#### `ipl_dues`

| Column | Type | Rules |
|--------|------|--------|
| `id` | uuid PK | |
| `period_id` | uuid FK → ipl_periods | |
| `unit_id` | uuid FK → units | |
| `residence_id` | uuid FK → residences | denormalized for report GROUP BY (set at insert from unit) |
| `luas_snapshot_m2` | numeric(10,2) | copy of unit luas at generation |
| `fee_per_m2_snapshot_idr` | bigint | copy of rate at generation |
| `amount_idr` | bigint | `round(luas_snapshot_m2 * fee_per_m2_snapshot_idr)` — immutable |
| `created_at` | timestamptz | |

**UNIQUE** `(period_id, unit_id)`. Index `(period_id, residence_id)`.

App invariant on insert: unit’s residence is in the period’s management group.

#### `ipl_payment_proofs`

| Column | Type | Rules |
|--------|------|--------|
| `id` | uuid PK | |
| `due_id` | uuid FK → ipl_dues | indexed |
| `blob_key` | text | Netlify Blobs object key; required |
| `mime_type` | text | `image/jpeg` \| `image/png` \| `image/webp` |
| `byte_size` | int | `1 … 5_000_000` |
| `status` | text | `pending` \| `verified` \| `rejected` |
| `uploaded_by_user_id` | uuid FK → user | |
| `uploaded_at` | timestamptz | |
| `reviewed_by_user_id` | uuid FK → user | null until review |
| `reviewed_at` | timestamptz | null until review |
| `review_note` | text | optional; max 1000; required when `rejected` |

**Partial UNIQUE:** at most one row per `due_id` where `status IN ('pending','verified')`  
(re-upload after reject inserts a new row; history of rejects kept).

Index: `(status, uploaded_at)` for staff Verifikasi queue (filter via join to dues in group).

#### `luas_change_requests`

| Column | Type | Rules |
|--------|------|--------|
| `id` | uuid PK | |
| `unit_id` | uuid FK → units | |
| `proposed_luas_m2` | numeric(10,2) | `> 0` |
| `status` | text | `pending` \| `approved` \| `rejected` |
| `requested_by_user_id` | uuid FK → user | |
| `requested_at` | timestamptz | |
| `reviewed_by_user_id` | uuid FK → user | null until review |
| `reviewed_at` | timestamptz | |
| `review_note` | text | optional; max 1000 |

**Partial UNIQUE:** at most one `pending` request per `unit_id`.  
On approve: set `units.luas_tanah_m2 = proposed_luas_m2` (future dues only).

#### `expenses`

| Column | Type | Rules |
|--------|------|--------|
| `id` | uuid PK | |
| `management_group_id` | uuid FK → management_groups | denormalized with period for safer queries |
| `period_id` | uuid FK → ipl_periods | **required** — which report month |
| `category` | text | required; trim; max 100 (free text MVP; seed common labels) |
| `amount_idr` | bigint | `> 0` |
| `expense_date` | date | required (display/sort); must fall in period’s calendar month (app check) |
| `note` | text | optional; max 500 |
| `receipt_blob_key` | text | optional |
| `receipt_mime_type` | text | null or same allowlist as proofs |
| `receipt_byte_size` | int | null or `1 … 5_000_000` |
| `created_by_user_id` / `updated_by_user_id` | uuid FK → user | |
| `created_at` / `updated_at` | timestamptz | |

Index: `(period_id, expense_date)`. App invariant: `expense.management_group_id == period.management_group_id`.

#### `monthly_reports`

Totals are **not** stored (avoid stale saldo). This row holds staff notes only.

| Column | Type | Rules |
|--------|------|--------|
| `period_id` | uuid PK/FK → ipl_periods | 1:1 |
| `keterangan` | text | default `''`; max 5000 |
| `updated_at` | timestamptz | |
| `updated_by_user_id` | uuid FK → user | |

Ensure row on first keterangan edit or lazily on report open (upsert).

### 6.3 Indexes (required)

| Index | Why |
|-------|-----|
| `management_group_residences (residence_id)` UNIQUE | resolve group from membership residence |
| `units (residence_id, label)` UNIQUE | import / display |
| `unit_memberships (membership_id)` | resident “my dues” |
| `ipl_periods (management_group_id, year_month)` UNIQUE | open period |
| `ipl_dues (period_id, unit_id)` UNIQUE | generation idempotency |
| `ipl_dues (period_id, residence_id)` | report income split |
| `ipl_payment_proofs (due_id)` + partial unique active | proof lifecycle |
| `ipl_payment_proofs (status, uploaded_at)` | Verifikasi queue |
| `luas_change_requests` partial unique pending per unit | one open request |
| `expenses (period_id, expense_date)` | report lines |

### 6.4 Money rules

| Rule | Detail |
|------|--------|
| Income in report | Only dues with a **verified** proof for that period |
| Income display | Sum `ipl_dues.amount_idr` grouped by `residence_id` (labels via `sort_order`) |
| Expenses | All rows for `period_id`; shared list |
| Saldo total | `(sum verified A + sum verified B) − sum(expenses.amount_idr)` |
| Due amount | Snapshot at generation; fee/luas edits never rewrite existing `ipl_dues` |

---

## 7. Flows & rules

1. Staff set `fee_per_m2` and unit luas (manual and/or spreadsheet import); residents may open `LuasChangeRequest`.
2. Staff (or scheduled/ops action) **open** a period → system creates `IplDue` rows from current luas × fee snapshots.
3. Resident uploads screenshot → proof `pending`.
4. Manager/Accountant → `verified` (counts in report) or `rejected`.
5. Staff add/edit expenses (category, amount, date, optional receipt).
6. Combined report (web + PDF): IPL A, IPL B, expense lines, saldo, `keterangan` (staff-editable).

**Luas change (MVP):** approve updates the unit’s `luas_tanah_m2` for **next** period generation only — does not rewrite verified history or past dues.

**Proofs:** at most one `pending` or `verified` proof per due (partial unique). Reject keeps history; resident may upload again.

---

## 8. Monthly report & PDF

### 8.1 On-screen / PDF sections (locked)

1. Pemasukan IPL Residensi A: *x*
2. Pemasukan IPL Residensi B: *y*
3. Pengeluaran 1…n (shared list)
4. Saldo total
5. Keterangan (editable block at end; staff only)

### 8.2 PDF (locked)

| Decision | Choice | Why |
|----------|--------|-----|
| Library | **`@react-pdf/renderer`** | ~2–3 MB, no Chromium; typical gen &lt;500ms; fits Netlify functions |
| API | Server-only `renderToBuffer` → `application/pdf` download | No filesystem; predictable cold start |
| Content | Same sections as on-screen, including `keterangan` | Single source of report section order (§8.1) |
| Fonts | Bundle a TTF that covers Indonesian Latin (e.g. Noto Sans) via `Font.register` | Avoid missing-glyph boxes |
| Who downloads | **`canIplStaff` only** in MVP | Residents use web Laporan |

**Rejected for MVP:** Puppeteer / Playwright / `@sparticuz/chromium` (huge binary, slow, brittle on serverless); paid HTML→PDF APIs (extra vendor); pdfkit-only (worse maintainability than React document components for this report).

---

## 9. UI

| Surface | Tabs / content |
|---------|----------------|
| Resident home | **Masalah** \| **IPL** \| **Laporan** — IPL: due tiles + upload |
| Staff home | **Verifikasi** (pending queue first) \| **Pengeluaran** \| **Laporan** |
| Copy | Bahasa Indonesia for menus, labels, statuses |
| PWA | Installable; network required for uploads and live data |

Staff home is for users with `canIplStaff`. A user who is only `accountant` sees IPL staff tabs, not problem-manager queue.

---

## 10. Technical fit (locked)

| Area | Choice | Why |
|------|--------|-----|
| App | Same TanStack Start app as parent | One deploy, shared auth |
| DB | Drizzle migrations on Netlify Database | Same as parent |
| Authz | Membership + role checks in server functions | Same as parent |
| Files | **Netlify Blobs** via `getStore('ipl-uploads')` (site-scoped, survives deploys) | Same platform; no second cloud account |
| Blob key (proof) | `{residenceId}/{unitLabel}/{yearMonth}/{proofId}.{ext}` e.g. `res-1/1A/2026-08/{id}.jpg` | Segment by residence + **unit** (many people / units in one residence); `proofId` keeps reject history |
| Blob key (receipt) | `{managementGroupId}/expenses/{periodYearMonth}/{expenseId}.{ext}` | Shared expenses are not per-unit |
| Upload allowlist | `image/jpeg`, `image/png`, `image/webp`; max **5 MB** | Proofs + receipts |
| Serve file | Authenticated server fn streams blob (no public anonymous URLs in MVP) | Tenancy on read |
| PDF | **`@react-pdf/renderer`** | See §8.2 |
| PWA | **`vite-plugin-pwa`** | Installable; network still required for live data/uploads |

Env: no new secrets for Blobs on Netlify; never `VITE_` for private keys. Local: Netlify Dev sandbox blobs (not production data).

---

## 11. Testing focus

- Formula and amount snapshot on due creation
- Only `verified` IPL enters residence income totals
- Combined saldo across two residences + shared expenses
- Role gates: resident cannot verify or add expenses; accountant can; accountant cannot manage problem queue
- Approved luas applies to **next** period generation only
- PDF sections match on-screen report including `keterangan`
- Tenancy: own-unit only; no cross-residence leak; both linked residences see same report
- Proofs: one active pending/verified; reject+note then re-upload; distinct blob keys per unit
- Closed period blocks writes; MIME/size allowlist; duplicate `openPeriod` → 409
- Missing luas/rate blocks period open (no silent partial dues)

Full numbered gate: plan Global Constraints → Edge cases.

---

## 12. Alternatives considered

| Topic | Options | Decision |
|-------|---------|----------|
| Product shape | Separate app vs lean add-on | **Lean add-on** in this repo |
| Reports | Two PDFs vs one combined | **One combined** report |
| Verification | OCR vs manual | **Manual** for MVP |
| Accountant vs manager | Reuse manager only vs new role | **New `accountant`** — IPL staff, not problem manager |
| Group link | Hardcoded IDs vs `management_group` | **`management_group` tables** (seed the two residences) |
| Expenses | Per-residence ledgers vs shared | **Shared** on management group |
| PDF | Puppeteer / HTML API vs `@react-pdf/renderer` | **`@react-pdf/renderer`** — size + speed + maintainability |
| Files | S3/R2 vs Netlify Blobs | **Netlify Blobs** — one platform |
| Report totals | Materialized columns vs compute | **Compute on read** — no stale saldo |
| PWA | Manual SW vs `vite-plugin-pwa` | **`vite-plugin-pwa`** |

---

## 13. Open questions

Still for implementation plan (stack/schema above are locked):

1. Spreadsheet import columns for units + luas (e.g. `residence_slug,label,luas_tanah_m2`).
2. Whether `ipl_periods.status = closed` hard-blocks edits in MVP or is display-only.
3. Expense category: free text only vs small fixed enum later.

---

## 14. Decision

| Field | Value |
|-------|-------|
| Outcome | **Accepted** |
| Date | 2026-08-12 |
| Plan | [`../superpowers/plans/2026-08-12-ipl-tracker.md`](../superpowers/plans/2026-08-12-ipl-tracker.md) |
