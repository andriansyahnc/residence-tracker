import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'

export type IplReportPdfView = {
  yearMonth: string
  residences: { id: string; name: string; incomeIdr: number }[]
  expenses: { id: string; category: string; amountIdr: number }[]
  saldoTotalIdr: number
  keterangan: string
}

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

/** '2026-08' -> 'Agustus 2026'. Falls back to the raw value if it is not YYYY-MM. */
function monthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split('-')
  const name = MONTHS[Number(month) - 1]
  return name ? `${name} ${year}` : yearMonth
}

function rupiah(value: number) {
  return `Rp ${value.toLocaleString('id-ID')}`
}

const INK = '#111827'
const MUTED = '#6b7280'
const LINE = '#d1d5db'
const BAND = '#f3f4f6'
const ACCENT = '#ea580c'

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontSize: 10,
    color: INK,
  },

  header: {
    borderBottomWidth: 2,
    borderBottomColor: ACCENT,
    paddingBottom: 10,
    marginBottom: 22,
  },
  title: { fontSize: 17, letterSpacing: 1 },
  period: { fontSize: 11, color: MUTED, marginTop: 4 },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: MUTED,
    marginBottom: 8,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: BAND,
  },
  headCell: { fontSize: 9, letterSpacing: 0.6, color: MUTED },
  label: { flex: 1, paddingRight: 12 },
  amount: { width: 130, textAlign: 'right' },

  subtotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  subtotalLabel: { flex: 1, paddingRight: 12, color: MUTED },
  subtotalAmount: { width: 130, textAlign: 'right' },

  saldo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    padding: 12,
    backgroundColor: BAND,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  saldoLabel: { fontSize: 11, letterSpacing: 0.8 },
  saldoAmount: { fontSize: 14 },

  note: {
    marginTop: 22,
    padding: 12,
    borderWidth: 0.5,
    borderColor: LINE,
    minHeight: 60,
  },
  noteText: { lineHeight: 1.5 },
  empty: { color: MUTED },

  appNote: { marginTop: 12, fontSize: 9, color: MUTED, lineHeight: 1.5 },

  signature: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 34 },
  signatureBox: { width: 190, alignItems: 'center' },
  signatureRole: { marginBottom: 46, color: MUTED },
  signatureLine: {
    width: '100%',
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 5,
    textAlign: 'center',
    color: MUTED,
    fontSize: 9,
  },

  footer: {
    position: 'absolute',
    bottom: 28,
    left: 44,
    right: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 6,
    fontSize: 8,
    color: MUTED,
  },
})

function Table({
  head,
  rows,
  totalLabel,
  total,
}: {
  head: [string, string]
  rows: { id: string; label: string; amountIdr: number }[]
  totalLabel: string
  total: number
}) {
  return (
    <View>
      <View style={styles.rowHead}>
        <Text style={[styles.headCell, styles.label]}>{head[0]}</Text>
        <Text style={[styles.headCell, styles.amount]}>{head[1]}</Text>
      </View>
      {rows.length === 0 ? (
        <View style={styles.row}>
          <Text style={[styles.label, styles.empty]}>Tidak ada data</Text>
          <Text style={styles.amount}>{rupiah(0)}</Text>
        </View>
      ) : (
        rows.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.label}>{r.label}</Text>
            <Text style={styles.amount}>{rupiah(r.amountIdr)}</Text>
          </View>
        ))
      )}
      <View style={styles.subtotal}>
        <Text style={styles.subtotalLabel}>{totalLabel}</Text>
        <Text style={styles.subtotalAmount}>{rupiah(total)}</Text>
      </View>
    </View>
  )
}

function IplReportDocument({ report }: { report: IplReportPdfView }) {
  const incomeTotal = report.residences.reduce((a, r) => a + r.incomeIdr, 0)
  const expenseTotal = report.expenses.reduce((a, e) => a + e.amountIdr, 0)

  return (
    <Document
      title={`Laporan IPL ${report.yearMonth}`}
      author="Residence Tracker"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>LAPORAN KEUANGAN IPL</Text>
          <Text style={styles.period}>Periode {monthLabel(report.yearMonth)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PEMASUKAN</Text>
          <Table
            head={['Cluster', 'Jumlah']}
            rows={report.residences.map((r) => ({
              id: r.id,
              label: r.name,
              amountIdr: r.incomeIdr,
            }))}
            totalLabel="Total pemasukan"
            total={incomeTotal}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PENGELUARAN</Text>
          <Table
            head={['Kategori', 'Jumlah']}
            rows={report.expenses.map((e) => ({
              id: e.id,
              label: e.category,
              amountIdr: e.amountIdr,
            }))}
            totalLabel="Total pengeluaran"
            total={expenseTotal}
          />
        </View>

        <View style={styles.saldo}>
          <Text style={styles.saldoLabel}>SALDO</Text>
          <Text style={styles.saldoAmount}>{rupiah(report.saldoTotalIdr)}</Text>
        </View>

        <View style={styles.note}>
          <Text style={styles.sectionTitle}>KETERANGAN</Text>
          <Text style={[styles.noteText, report.keterangan ? {} : styles.empty]}>
            {report.keterangan || 'Tidak ada keterangan.'}
          </Text>
        </View>

        <Text style={styles.appNote}>
          Ini ringkasan. Rincian per unit, bukti transfer dan nota pengeluaran
          dapat dilihat di aplikasi Residence Tracker.
        </Text>

        <View style={styles.signature}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureRole}>Bendahara</Text>
            <Text style={styles.signatureLine}>Nama &amp; tanda tangan</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>Laporan IPL {monthLabel(report.yearMonth)}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Halaman ${pageNumber} dari ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}

export async function renderIplReportPdf(report: IplReportPdfView) {
  return renderToBuffer(<IplReportDocument report={report} />)
}
