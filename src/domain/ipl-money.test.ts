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
