import { describe, expect, it } from 'vitest'
import { renderIplReportPdf } from '../server/ipl-pdf'

describe('ipl pdf', () => {
  it('renders PDF with keterangan', async () => {
    const bytes = await renderIplReportPdf({
      yearMonth: '2026-08',
      residences: [
        { id: 'res-1', name: 'Oak', incomeIdr: 1000 },
        { id: 'res-2', name: 'Pine', incomeIdr: 500 },
      ],
      expenses: [{ id: 'e1', category: 'Kebersihan', amountIdr: 200 }],
      saldoTotalIdr: 1300,
      keterangan: 'Catatan akhir bulan',
    })
    const head = String.fromCharCode(...bytes.slice(0, 4))
    expect(head).toBe('%PDF')
    expect(bytes.byteLength).toBeGreaterThan(100)
  })
})
