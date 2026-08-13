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
