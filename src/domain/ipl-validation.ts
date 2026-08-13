import type { ValidationResult } from './types'

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 5_000_000

export type ProofMime = 'image/jpeg' | 'image/png' | 'image/webp'

export function validateYearMonth(value: string): ValidationResult<string> {
  const trimmed = value.trim()
  if (!YEAR_MONTH_RE.test(trimmed)) {
    return { ok: false, error: 'year_month must be YYYY-MM' }
  }
  return { ok: true, value: trimmed }
}

export function validateLuas(value: number): ValidationResult<number> {
  if (!(value > 0) || !Number.isFinite(value)) {
    return { ok: false, error: 'luas must be > 0' }
  }
  return { ok: true, value }
}

export function validateFeePerM2(value: number): ValidationResult<number> {
  if (!(value > 0) || !Number.isInteger(value)) {
    return { ok: false, error: 'fee_per_m2 must be a positive integer IDR' }
  }
  return { ok: true, value }
}

export function validateProofMeta(input: {
  mimeType: string
  byteSize: number
}): ValidationResult<{ mimeType: ProofMime; byteSize: number }> {
  if (!ALLOWED_MIME.has(input.mimeType)) {
    return { ok: false, error: 'mime type not allowed' }
  }
  if (!(input.byteSize >= 1) || input.byteSize > MAX_BYTES) {
    return { ok: false, error: 'file size must be 1..5000000 bytes' }
  }
  return {
    ok: true,
    value: {
      mimeType: input.mimeType as ProofMime,
      byteSize: input.byteSize,
    },
  }
}

export function validateReviewNoteForReject(
  status: 'verified' | 'rejected',
  reviewNote: string | undefined,
): ValidationResult<string | undefined> {
  if (status !== 'rejected') {
    return { ok: true, value: reviewNote }
  }
  const note = reviewNote?.trim() ?? ''
  if (!note) {
    return { ok: false, error: 'review_note required when rejected' }
  }
  if (note.length > 1000) {
    return { ok: false, error: 'review_note too long' }
  }
  return { ok: true, value: note }
}

export function validateExpenseInput(input: {
  category: string
  amountIdr: number
  expenseDate: string
  note?: string
}): ValidationResult<{
  category: string
  amountIdr: number
  expenseDate: string
  note?: string
}> {
  const category = input.category.trim()
  if (!category || category.length > 100) {
    return { ok: false, error: 'category required (max 100)' }
  }
  if (!(input.amountIdr > 0) || !Number.isInteger(input.amountIdr)) {
    return { ok: false, error: 'amount must be positive integer IDR' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expenseDate)) {
    return { ok: false, error: 'expense_date must be YYYY-MM-DD' }
  }
  const note = input.note?.trim()
  if (note && note.length > 500) {
    return { ok: false, error: 'note too long' }
  }
  return {
    ok: true,
    value: {
      category,
      amountIdr: input.amountIdr,
      expenseDate: input.expenseDate,
      note: note || undefined,
    },
  }
}
