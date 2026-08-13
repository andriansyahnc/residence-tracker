# Design: IPL Tracker (beside Problem Tracker)

| Field | Value |
|-------|-------|
| Status | Approved for planning |
| Date | 2026-08-12 |
| Product language | Bahasa Indonesia (UI) |
| Approach | Lean add-on in this repo |
| Related | Existing problem tracker PRD/RFCs; shared auth & membership |

## 1. Summary

Add an **IPL (iuran pengelolaan lingkungan)** module next to the existing residence problem tracker. Residents upload payment proof screenshots; Manager/Accountant verify payments; everyone can see a **single combined monthly money report** for the two residences under management; managers generate that report as PDF. Ship as a **PWA**. **OCR is out of MVP** (manual verify only).

## 2. Goals and non-goals

### Goals

- Resident: see monthly IPL due, upload payment screenshot, see residence money report.
- Manager / Accountant: verify (or reject) proofs; manage fee/m² and unit land area; record shared expenses; edit end-of-report notes; download PDF.
- Formula: `ipl_due = luas_tanah_m2 × fee_per_m2` (IDR); fee per m² is editable.
- Two residences in one management scope; **one combined report** (not two separate report documents).
- Indonesian UI copy; installable PWA.

### Non-goals (MVP)

- OCR / auto-read of transfer screenshots
- Late fees, reminders, push/email notifications
- Resident-submitted expenses
- Separate per-residence expense ledgers
- Replacing the problem tracker

## 3. Roles

| Role | IPL powers |
|------|------------|
| **Resident** | View own unit due; upload proof; request luas change; view combined report |
| **Manager** | All IPL staff powers below |
| **Accountant** | Same IPL powers as Manager for MVP |

Staff powers: set/import unit `luas_tanah`; set `fee_per_m2` per residence; verify/reject proofs; add/edit expenses; edit report keterangan; generate PDF.

Problem-tracker roles stay as today; `accountant` is an additional membership role used for IPL (and may have no extra problem powers beyond resident unless already manager).

## 4. Domain model

Scoped by existing `residence_id` where applicable. Two residences share one **management group** for reporting (MVP: hardcode/link the two known residences as one report scope).

| Entity | Purpose |
|--------|---------|
| **Unit** | Belongs to one residence; has `luas_tanah_m2`; linked to resident membership(s) |
| **IplRate** | `fee_per_m2` (IDR) per residence; changeable by staff |
| **IplPeriod** | Calendar month (e.g. `2026-08`) for the management group |
| **IplDue** | Per unit per period: amount = luas × fee at generation time (snapshot) |
| **IplPaymentProof** | Screenshot upload; status `pending` \| `verified` \| `rejected` |
| **LuasChangeRequest** | Resident proposes new luas; staff approve/reject |
| **Expense** | Shared across both residences: amount, category, date, optional receipt photo |
| **MonthlyReport** | One per period for the management group: computed totals + editable `keterangan` (notes at end) |

**Income counted in report:** only `verified` IPL for that period, listed separately per residence A and B.

**Expenses:** not tagged to a single residence; they belong to the shared report.

**Saldo total:** `(IPL A verified + IPL B verified) − sum(expenses in period)`.

## 5. User flows

1. Staff set fee/m² and unit luas (manual and/or spreadsheet import); residents may request luas changes.
2. System opens monthly dues from formula (snapshot amount on the due).
3. Resident uploads screenshot → proof `pending`.
4. Manager/Accountant verifies → `verified` (counts in report) or `rejected`.
5. Staff add expenses (category, amount, date, optional receipt).
6. Combined report (web + PDF): IPL A, IPL B, expense lines, saldo total, keterangan at end (staff-editable).

## 6. UI (locked choices)

- **Language:** Bahasa Indonesia for menus, labels, status.
- **Resident home:** Tabs — Masalah | IPL | Laporan; IPL shows due tiles + upload.
- **Staff home:** Tabs — Verifikasi first (pending queue) | Pengeluaran | Laporan.
- **Report:** One screen/PDF for both residences:
  - Pemasukan IPL Residensi A: x
  - Pemasukan IPL Residensi B: y
  - Pengeluaran 1…n (shared list)
  - Saldo total
  - Keterangan (editable block at end)
- **PWA:** installable; network required for uploads and live data.

## 7. Technical fit

- Same TanStack Start app, Netlify Database, session auth, tenancy patterns as problem tracker.
- New tables/migrations for IPL entities; file storage for screenshots/receipts (Netlify Blobs or equivalent — choose in implementation plan).
- PDF generation on server (library chosen in plan).
- PWA via Vite PWA plugin (or equivalent) in implementation plan.

## 8. Testing focus

- Formula and amount snapshot on due creation
- Only verified IPL enters residence income totals
- Combined saldo math across two residences + shared expenses
- Role gates: resident cannot verify or add expenses; accountant can
- Luas change request approve/reject updates future dues (not silently rewriting verified history without rule — MVP: approved luas applies to next period generation)
- PDF contains same sections as on-screen report including keterangan

## 9. Open for implementation plan (not blocking design)

- Exact blob/storage provider for images
- PDF library choice
- How the two residences are linked as one management group in schema (config row vs `management_group_id`)
- Whether `accountant` can access problem-tracker manager features (default: no, unless also manager)
