# IPL Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the IPL add-on (dues, proof verify, shared expenses, combined monthly report + PDF, PWA) beside the existing problem tracker.

**Architecture:** Extend the current TanStack Start + Drizzle + Netlify app. Pure domain math/permissions stay in `src/domain/*` (TDD). Persistence extends `src/db/schema.ts` + `src/lib/store.ts` (or a focused `src/lib/ipl-store.ts` that reuses `getDb` / session patterns). UI uses Indonesian copy with resident/staff tab shells. Files via Netlify Blobs; PDF via `@react-pdf/renderer` server-side.

**Tech Stack:** TanStack Start, Drizzle, Vitest, Netlify Blobs (`@netlify/blobs`), `@react-pdf/renderer`, `vite-plugin-pwa`, Tailwind (existing).

**Specs:** [`docs/rfc/2026-08-12-ipl-tracker.md`](../../rfc/2026-08-12-ipl-tracker.md) · [`docs/superpowers/specs/2026-08-12-ipl-tracker-design.md`](../specs/2026-08-12-ipl-tracker-design.md)

## Global Constraints

- UI copy: Bahasa Indonesia for menus, labels, statuses.
- Formula: `amount_idr = round(luas_tanah_m2 × fee_per_m2_idr)`; snapshot on due creation; never rewrite past dues.
- Income: only dues with a **verified** proof count.
- Saldo: `(IPL A verified + IPL B verified) − sum(expenses)`.
- Roles: `resident | manager | accountant`; `canIplStaff = manager|accountant`; accountant does **not** get problem-manager powers.
- Files: Netlify Blobs store `ipl-uploads`; MIME `image/jpeg|png|webp`; max 5 MB; authenticated read.
- PDF: `@react-pdf/renderer` + Noto Sans; staff-only download.
- PWA: `vite-plugin-pwa`; network required for uploads/live data.
- Match existing repo style: `text` PKs (`id('prefix')`), ISO string timestamps, `createServerFn`, Vitest, `#/*` imports via relative paths like today.
- Open-question defaults: CSV columns `residence_id,label,luas_tanah_m2`; closed period **blocks** new proofs/expense writes; expense `category` free text (max 100).
- Blob proof key: `{residenceId}/{unitLabel}/{yearMonth}/{proofId}.{ext}` (segment by **unit**, not only residence).
- **Edge cases (must have tests in Task 15; encode earlier where natural):**
  1. Non-member / wrong residence → no IPL data (404/empty), never leak other residence.
  2. Resident sees **own unit** dues only; cannot upload for another unit.
  3. Two units in same residence → distinct blob keys (`…/1A/…` vs `…/1B/…`); no overwrite across units.
  4. Pending proof blocks second pending; after **reject**, re-upload allowed (new row + new key).
  5. Reject without `review_note` → 400.
  6. `pending` / `rejected` never enter report income; only `verified`.
  7. Fee/luas change after open period does **not** rewrite existing `ipl_dues`.
  8. Approved luas applies to **next** `openPeriod` only.
  9. One pending luas request per unit; second pending → 400.
  10. Closed period → proof upload / expense write / verify blocked.
  11. Expense `expense_date` outside period’s calendar month → 400.
  12. Accountant: IPL staff OK; problem queue/status **denied**.
  13. Resident: cannot verify, add expense, edit keterangan, or download PDF.
  14. Member of either linked residence sees the **same** combined report; outsider does not.
  15. Upload MIME/size outside allowlist → 400; authenticated blob read only.
  16. `openPeriod` twice for same `year_month` → idempotent or 409 (pick one; prefer **409**).
  17. Unit without `luas` / residence without rate → `openPeriod` fails clearly (no partial silent dues).
  18. PDF sections match on-screen report including `keterangan` (empty string OK).

## File map

| Path | Responsibility |
|------|----------------|
| `src/domain/types.ts` | Add IPL types + `accountant` role |
| `src/domain/permissions.ts` | `canIplStaff`, problem gates unchanged for accountant |
| `src/domain/ipl-money.ts` | Due amount + report saldo pure functions |
| `src/domain/ipl-validation.ts` | Input validation for IPL writes |
| `src/db/schema.ts` | New tables + membership role enum |
| `src/db/seed.ts` | Two residences, group, units, rates, accountant |
| `src/lib/ipl-store.ts` | DB operations for IPL |
| `src/lib/blobs.ts` | Netlify Blobs put/get helpers |
| `src/server/ipl.functions.ts` | Server functions |
| `src/server/ipl-pdf.tsx` | React-PDF document + render helper |
| `src/routes/...` | Resident/staff IPL + laporan routes |
| `src/components/ipl-*.tsx` | Tab shells / tiles (keep UI thin) |
| `vite.config.ts` | `vite-plugin-pwa` |
| `src/domain/*.test.ts` | Unit tests |

---

### Task 1: Role `accountant` + IPL permission helpers

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/permissions.ts`
- Modify: `src/domain/permissions.test.ts`
- Modify: `src/db/schema.ts` (membership role enum only)

**Interfaces:**
- Produces: `Role` includes `'accountant'`; `canIplStaff(m)`, `canManageProblems(m)` (= manager only)

- [ ] **Step 1: Write failing permission tests**

```ts
// append to src/domain/permissions.test.ts
import { canIplStaff, canManageProblems, canManageQueue } from './permissions'

const accountantMembership: Membership = {
  userId: 'user-accountant',
  residenceId: 'res-1',
  role: 'accountant',
}

it('accountant is IPL staff but not problem manager', () => {
  expect(canIplStaff(accountantMembership)).toBe(true)
  expect(canManageProblems(accountantMembership)).toBe(false)
  expect(canManageQueue(accountantMembership)).toBe(false)
})

it('manager is IPL staff and problem manager', () => {
  expect(canIplStaff(managerMembership)).toBe(true)
  expect(canManageProblems(managerMembership)).toBe(true)
})

it('resident is not IPL staff', () => {
  expect(canIplStaff(residentMembership)).toBe(false)
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm test src/domain/permissions.test.ts`
Expected: FAIL (missing exports / role type)

- [ ] **Step 3: Implement types + permissions + schema enum**

```ts
// types.ts
export type Role = 'resident' | 'manager' | 'accountant'
```

```ts
// permissions.ts
export function canIplStaff(membership: Membership): boolean {
  return membership.role === 'manager' || membership.role === 'accountant'
}

export function canManageProblems(membership: Membership): boolean {
  return membership.role === 'manager'
}
```

Update `canViewProblem` / `canCommentOnProblem` / `canManageQueue` so accountant behaves like **resident** for problems (not manager).

```ts
// schema memberships role
role: text('role', { enum: ['resident', 'manager', 'accountant'] }).notNull(),
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm test src/domain/permissions.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/domain/permissions.ts src/domain/permissions.test.ts src/db/schema.ts
git commit -m "feat(ipl): add accountant role and IPL staff permissions"
```

---

### Task 2: Pure money + report math

**Files:**
- Create: `src/domain/ipl-money.ts`
- Create: `src/domain/ipl-money.test.ts`

**Interfaces:**
- Produces:
  - `computeDueAmountIdr(luasM2: number, feePerM2Idr: number): number`
  - `computeSaldoTotal(incomeByResidenceIdr: number[], expenseTotalIdr: number): number`
  - `sumVerifiedIncome(dues: { residenceId: string; amountIdr: number; verified: boolean }[]): { byResidence: Record<string, number>; total: number }`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  computeDueAmountIdr,
  computeSaldoTotal,
  sumVerifiedIncome,
} from './ipl-money'

describe('computeDueAmountIdr', () => {
  it('snapshots round(luas * fee)', () => {
    expect(computeDueAmountIdr(12.5, 10000)).toBe(125000)
    expect(computeDueAmountIdr(10.25, 3333)).toBe(34163) // Math.round
  })
})

describe('sumVerifiedIncome', () => {
  it('counts only verified', () => {
    const result = sumVerifiedIncome([
      { residenceId: 'res-a', amountIdr: 100, verified: true },
      { residenceId: 'res-a', amountIdr: 50, verified: false },
      { residenceId: 'res-b', amountIdr: 80, verified: true },
    ])
    expect(result.byResidence).toEqual({ 'res-a': 100, 'res-b': 80 })
    expect(result.total).toBe(180)
  })
})

describe('computeSaldoTotal', () => {
  it('income minus expenses', () => {
    expect(computeSaldoTotal([100, 80], 50)).toBe(130)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm test src/domain/ipl-money.test.ts`

- [ ] **Step 3: Implement**

```ts
export function computeDueAmountIdr(luasM2: number, feePerM2Idr: number): number {
  if (!(luasM2 > 0) || !(feePerM2Idr > 0)) {
    throw new Error('luas and fee must be > 0')
  }
  return Math.round(luasM2 * feePerM2Idr)
}

export function sumVerifiedIncome(
  dues: { residenceId: string; amountIdr: number; verified: boolean }[],
): { byResidence: Record<string, number>; total: number } {
  const byResidence: Record<string, number> = {}
  for (const d of dues) {
    if (!d.verified) continue
    byResidence[d.residenceId] = (byResidence[d.residenceId] ?? 0) + d.amountIdr
  }
  const total = Object.values(byResidence).reduce((a, b) => a + b, 0)
  return { byResidence, total }
}

export function computeSaldoTotal(
  incomeByResidenceIdr: number[],
  expenseTotalIdr: number,
): number {
  const income = incomeByResidenceIdr.reduce((a, b) => a + b, 0)
  return income - expenseTotalIdr
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/domain/ipl-money.ts src/domain/ipl-money.test.ts
git commit -m "feat(ipl): add due amount and report saldo helpers"
```

---

### Task 3: Drizzle schema for IPL tables

**Files:**
- Modify: `src/db/schema.ts`
- Run: `pnpm db:generate`

**Interfaces:**
- Produces: tables from RFC §6.2 using **text PKs** + ISO `text` timestamps (repo convention). Money: `bigint` via drizzle `bigint({ mode: 'number' })`. Luas: `numeric({ precision: 10, scale: 2, mode: 'number' })` or store as text decimal — prefer numeric mode number. Partial unique indexes: use uniqueIndex where Drizzle supports; if partial unique needs raw SQL migration, add in generated SQL.

Follow RFC column names (camelCase in Drizzle). Include: `managementGroups`, `managementGroupResidences`, `units`, `unitMemberships`, `iplRates`, `iplPeriods`, `iplDues`, `iplPaymentProofs`, `luasChangeRequests`, `expenses`, `monthlyReports`.

- [ ] **Step 1: Add tables to `schema.ts`** (full definitions matching RFC; mirror style of `memberships` uniqueIndex helpers)

Example fragment:

```ts
import { bigint, integer, numeric, primaryKey } from 'drizzle-orm/pg-core'

export const managementGroups = pgTable('management_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
})

export const managementGroupResidences = pgTable(
  'management_group_residences',
  {
    managementGroupId: text('management_group_id')
      .notNull()
      .references(() => managementGroups.id),
    residenceId: text('residence_id')
      .notNull()
      .references(() => residences.id),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.managementGroupId, t.residenceId] }),
    uniqueIndex('mgr_residence_unique').on(t.residenceId),
    uniqueIndex('mgr_sort_unique').on(t.managementGroupId, t.sortOrder),
  ],
)

// ... units, unitMemberships, iplRates, iplPeriods, iplDues,
// iplPaymentProofs, luasChangeRequests, expenses, monthlyReports
// with unique indexes from RFC §6.3
```

For partial unique (one active proof): after `db:generate`, edit the SQL migration to add:

```sql
CREATE UNIQUE INDEX ipl_payment_proofs_active_due_uidx
  ON ipl_payment_proofs (due_id)
  WHERE status IN ('pending', 'verified');

CREATE UNIQUE INDEX luas_change_requests_pending_unit_uidx
  ON luas_change_requests (unit_id)
  WHERE status = 'pending';
```

- [ ] **Step 2: Generate migration**

Run: `pnpm db:generate`
Expected: new SQL under drizzle migrations folder (path from `drizzle.config.ts`)

- [ ] **Step 3: Apply locally** (per project DB workflow — `netlify db` / drizzle migrate as already used for problems)

- [ ] **Step 4: Commit schema + migration**

```bash
git add src/db/schema.ts drizzle
git commit -m "feat(ipl): add IPL drizzle schema and migration"
```

---

### Task 4: Seed two residences + IPL baseline

**Files:**
- Modify: `src/db/seed.ts`

**Interfaces:**
- Produces: `res-1`, `res-2` in group `mg-1`; rates; sample units; `accountant@example.com`; unit_memberships for demo resident

- [ ] **Step 1: Extend seed** with second residence, management group link (`sortOrder` 1/2), `ipl_rates`, units `A-01` / `B-01`, membership + unit link, accountant membership on both residences (or at least one — prefer both so staff sees combined report).

- [ ] **Step 2: Manually verify seed** via `netlify:dev` / existing seed entrypoint used by tests (`createTestDb` path).

- [ ] **Step 3: Commit**

```bash
git add src/db/seed.ts
git commit -m "feat(ipl): seed management group, units, rates, accountant"
```

---

### Task 5: Validation helpers for IPL inputs

**Files:**
- Create: `src/domain/ipl-validation.ts`
- Create: `src/domain/ipl-validation.test.ts`

**Interfaces:**
- Produces: `validateFeePerM2`, `validateLuas`, `validateYearMonth`, `validateExpenseInput`, `validateProofMeta` returning `ValidationResult<T>`

- [ ] **Step 1: Tests** for year_month `2026-08` ok / `2026-13` fail; luas ≤ 0 fail; fee ≤ 0 fail; MIME allowlist; size 0 and > 5_000_000 fail; reject note required when status rejected.

- [ ] **Step 2: Implement validators**

- [ ] **Step 3: `pnpm test src/domain/ipl-validation.test.ts` PASS**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ipl): validate IPL inputs"
```

---

### Task 6: `ipl-store` — rates, units, open period, dues snapshot

**Files:**
- Create: `src/lib/ipl-store.ts`
- Create: `src/lib/ipl-store.dues.test.ts` (use `createTestDb` like `store.test.ts`)

**Interfaces:**
- Consumes: `computeDueAmountIdr`, `canIplStaff`
- Produces:
  - `setFeePerM2(user, residenceId, fee)`
  - `upsertUnit(user, { residenceId, label, luasTanahM2 })`
  - `openPeriod(user, yearMonth)` → creates period + due rows for all units in group with snapshots
  - `listMyDues(user, yearMonth?)`

- [ ] **Step 1: Failing integration test** — open period snapshots amount; changing fee afterward does not change existing due `amountIdr`.

- [ ] **Step 2: Implement store methods** (copy `id`/`nowIso` patterns from `store.ts`; resolve management group from `user.residenceId`).

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ipl): store open-period due snapshots"
```

---

### Task 7: Blobs helper + proof upload/verify

**Files:**
- Create: `src/lib/blobs.ts`
- Extend: `src/lib/ipl-store.ts`
- Create: `src/server/ipl.functions.ts` (start)
- Create: `src/lib/ipl-store.proofs.test.ts`

**Interfaces:**
- Produces:
  - `putIplBlob(key, bytes, contentType)` / `getIplBlob(key)`
  - `uploadProof(user, dueId, file)` → pending
  - `reviewProof(user, proofId, { status: 'verified'|'rejected', reviewNote? })`
  - `listPendingProofs(user)`

Blob key (proof): `{residenceId}/{unitLabel}/{yearMonth}/{proofId}.{ext}`  
Examples: `res-1/1A/2026-08/{id}.jpg`, `res-1/1B/2026-08/{id}.jpg`  
(Segment by unit so many people/units in one residence don’t collide; `proofId` keeps rejected history.)  
Blob key (receipt): `{managementGroupId}/expenses/{yearMonth}/{expenseId}.{ext}`

```ts
// blobs.ts sketch
import { getStore } from '@netlify/blobs'

export function iplUploadStore() {
  return getStore('ipl-uploads')
}
```

- [ ] **Step 1: Unit/integration tests** for verify-only income flag; resident cannot `reviewProof`; accountant can; reject requires note; second pending while one pending fails.

- [ ] **Step 2: Implement** (for tests without Netlify, allow injectible blob adapter or skip blob bytes and store key only in DB tests)

- [ ] **Step 3: Server fns** `uploadIplProof`, `reviewIplProof`, `listPendingIplProofs` via `createServerFn` + `requireSessionUser`

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ipl): payment proof upload and verify"
```

---

### Task 8: Luas change requests

**Files:**
- Extend: `src/lib/ipl-store.ts`, `src/server/ipl.functions.ts`
- Create: `src/lib/ipl-store.luas.test.ts`

**Interfaces:**
- `requestLuasChange(user, unitId, proposedLuas)`
- `reviewLuasChange(user, requestId, approve|reject)`
- Approve updates `units.luasTanahM2` only; existing dues unchanged

- [ ] **Step 1: Test** approve does not rewrite due; next `openPeriod` uses new luas

- [ ] **Step 2: Implement + server fns**

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(ipl): luas change request approve/reject"
```

---

### Task 9: Expenses + keterangan

**Files:**
- Extend store + server fns
- Tests: `src/lib/ipl-store.expenses.test.ts`

**Interfaces:**
- `addExpense` / `updateExpense` (staff only)
- `upsertKeterangan(periodId, text)`
- Closed period: writes throw `AppError` 400

- [ ] **Step 1: Tests** resident cannot add; accountant can; expense date must be in period month

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(ipl): shared expenses and report keterangan"
```

---

### Task 10: Combined report query

**Files:**
- Extend: `src/lib/ipl-store.ts`
- Create: `src/lib/ipl-store.report.test.ts`

**Interfaces:**
- Produces: `getMonthlyReport(user, yearMonth) => { residences: { id, name, sortOrder, incomeIdr }[]; expenses: [...]; saldoTotalIdr; keterangan }`
- Uses `sumVerifiedIncome` + `computeSaldoTotal`

- [ ] **Step 1: Test** matches RFC money rules with two residences

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(ipl): combined monthly report query"
```

---

### Task 11: PDF download

**Files:**
- Create: `src/server/ipl-pdf.tsx`
- Extend: `src/server/ipl.functions.ts` with `downloadIplReportPdf`
- Add dep: `pnpm add @react-pdf/renderer`
- Font file under `src/assets/fonts/NotoSans-Regular.ttf` (or load from package)

**Interfaces:**
- `renderIplReportPdf(report): Promise<Uint8Array>`
- Server fn returns base64 or Response bytes; staff-only

```tsx
import { Document, Page, Text, Font, renderToBuffer } from '@react-pdf/renderer'

Font.register({ family: 'NotoSans', src: /* path or data */ })

export function IplReportDocument({ report }: { report: ReportView }) {
  return (
    <Document>
      <Page size="A4" style={{ fontFamily: 'NotoSans', padding: 40, fontSize: 11 }}>
        <Text>Laporan IPL {report.yearMonth}</Text>
        {report.residences.map((r) => (
          <Text key={r.id}>Pemasukan IPL {r.name}: {r.incomeIdr}</Text>
        ))}
        {report.expenses.map((e) => (
          <Text key={e.id}>{e.category}: {e.amountIdr}</Text>
        ))}
        <Text>Saldo total: {report.saldoTotalIdr}</Text>
        <Text>Keterangan: {report.keterangan}</Text>
      </Page>
    </Document>
  )
}

export async function renderIplReportPdf(report: ReportView) {
  return renderToBuffer(<IplReportDocument report={report} />)
}
```

- [ ] **Step 1: Add dependency + font**

- [ ] **Step 2: Unit test** that `renderIplReportPdf` returns bytes starting with `%PDF` (may run in Node vitest)

- [ ] **Step 3: Wire staff-only server fn**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ipl): staff PDF report via react-pdf"
```

---

### Task 12: Resident + staff UI (Bahasa Indonesia)

**Files:**
- Create routes under `src/routes/ipl/` and/or extend home with tabs:
  - Resident: Masalah | IPL | Laporan (link Masalah → `/problems`)
  - Staff (`canIplStaff`): Verifikasi | Pengeluaran | Laporan
- Reuse `AppShell` from `src/components/ui.tsx`; add thin IPL components
- Wire loaders to `ipl.functions.ts`

**Screens (MVP):**
1. IPL dues list + upload control
2. Verifikasi queue + verify/reject
3. Pengeluaran list + add form
4. Laporan view + (staff) keterangan edit + PDF button

- [ ] **Step 1: Add tabbed navigation matching RFC §9**

- [ ] **Step 2: Wire loaders/actions; Indonesian labels (`Menunggu`, `Terverifikasi`, `Ditolak`, etc.)**

- [ ] **Step 3: Manual smoke** `pnpm dev` — resident upload path + staff verify

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ipl): Indonesian resident and staff IPL UI"
```

---

### Task 13: CSV unit import (staff)

**Files:**
- `src/domain/ipl-import.ts` + test
- Server fn `importUnitsCsv`
- Staff UI control on units/settings section (can live under Pengeluaran area or small “Unit” staff page — prefer `/ipl/units`)

CSV: `residence_id,label,luas_tanah_m2` header required.

- [ ] **Step 1: Parser tests** (skip bad rows with error list; upsert by residence+label)

- [ ] **Step 2: Implement + UI**

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(ipl): CSV import for units and luas"
```

---

### Task 14: PWA

**Files:**
- `pnpm add -D vite-plugin-pwa`
- Modify: `vite.config.ts`
- Add: `public/icons/*` minimal icons + manifest via plugin config

```ts
import { VitePWA } from 'vite-plugin-pwa'

plugins: [
  // ...existing; PWA after tanstackStart/netlify as appropriate
  VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'Residence Tracker',
      short_name: 'Residence',
      lang: 'id',
      display: 'standalone',
      start_url: '/',
      background_color: '#ffffff',
      theme_color: '#0f172a',
    },
    workbox: {
      navigateFallback: '/',
      // network-first for app shell; do not pretend offline uploads work
    },
  }),
]
```

- [ ] **Step 1: Add plugin + icons**

- [ ] **Step 2: `pnpm build` succeeds; manifest present in dist**

- [ ] **Step 3: Commit**

```bash
git commit -am "feat: installable PWA via vite-plugin-pwa"
```

---

### Task 15: Acceptance gate

**Files:**
- Create: `src/lib/ipl-acceptance.test.ts` (or extend existing)

Cover **every** item in Global Constraints → Edge cases (1–18). Automate in unit/store tests; UI-only smoke can be manual notes in the report if not practical.

Also keep the original smoke set:

1. Due snapshot formula
2. Only verified income in report
3. Combined saldo two residences + expenses
4. Resident cannot verify / add expense; accountant can
5. Accountant cannot `canManageQueue`
6. Luas approve → next period only
7. PDF buffer is `%PDF` and includes keterangan string
8. Two units same residence → distinct blob key prefixes
9. Reject then re-upload succeeds; second pending while pending fails
10. Closed period blocks writes; bad MIME/size rejected

- [ ] **Step 1: Write acceptance tests mapping to edge cases 1–18**

- [ ] **Step 2: `pnpm test` full suite green**

- [ ] **Step 3: Commit**

```bash
git commit -am "test(ipl): MVP acceptance and edge-case coverage"
```

---

## Self-review

1. **Spec coverage:** Roles, schema, dues snapshot, proofs, luas, expenses, combined report, PDF, PWA, ID UI, CSV import, edge cases 1–18 — each has a task or Task 15 gate.
2. **Placeholders:** None intentional; blob test double called out explicitly in Task 7.
3. **Types:** `Role` / `canIplStaff` / report view shared across tasks 1→12.
4. **Repo fit:** text IDs + ISO timestamps match `store.ts`; RFC uuid/timestamptz mapped to existing conventions on purpose.
