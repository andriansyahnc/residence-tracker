import { describe, expect, it } from 'vitest'
import {
  validateExpenseInput,
  validateFeePerM2,
  validateLuas,
  validateProofMeta,
  validateReviewNoteForReject,
  validateYearMonth,
} from './ipl-validation'

describe('validateYearMonth', () => {
  it('accepts YYYY-MM', () => {
    expect(validateYearMonth('2026-08')).toEqual({ ok: true, value: '2026-08' })
  })

  it('rejects invalid month', () => {
    expect(validateYearMonth('2026-13').ok).toBe(false)
  })
})

describe('validateLuas', () => {
  it('rejects non-positive', () => {
    expect(validateLuas(0).ok).toBe(false)
    expect(validateLuas(-1).ok).toBe(false)
  })

  it('accepts positive', () => {
    expect(validateLuas(12.5)).toEqual({ ok: true, value: 12.5 })
  })
})

describe('validateFeePerM2', () => {
  it('rejects non-positive', () => {
    expect(validateFeePerM2(0).ok).toBe(false)
  })

  it('accepts positive integer', () => {
    expect(validateFeePerM2(10000)).toEqual({ ok: true, value: 10000 })
  })
})

describe('validateProofMeta', () => {
  it('rejects bad mime and size', () => {
    expect(
      validateProofMeta({ mimeType: 'application/pdf', byteSize: 100 }).ok,
    ).toBe(false)
    expect(
      validateProofMeta({ mimeType: 'image/jpeg', byteSize: 0 }).ok,
    ).toBe(false)
    expect(
      validateProofMeta({ mimeType: 'image/jpeg', byteSize: 5_000_001 }).ok,
    ).toBe(false)
  })

  it('accepts jpeg under 5MB', () => {
    expect(
      validateProofMeta({ mimeType: 'image/jpeg', byteSize: 1024 }),
    ).toEqual({
      ok: true,
      value: { mimeType: 'image/jpeg', byteSize: 1024 },
    })
  })
})

describe('validateReviewNoteForReject', () => {
  it('requires note when rejected', () => {
    expect(validateReviewNoteForReject('rejected', undefined).ok).toBe(false)
    expect(validateReviewNoteForReject('rejected', 'salah nominal').ok).toBe(
      true,
    )
    expect(validateReviewNoteForReject('verified', undefined).ok).toBe(true)
  })
})

describe('validateExpenseInput', () => {
  it('accepts valid expense', () => {
    expect(
      validateExpenseInput({
        category: 'Kebersihan',
        amountIdr: 1000,
        expenseDate: '2026-08-01',
      }).ok,
    ).toBe(true)
  })
})
