import { Document, Page, Text, renderToBuffer, StyleSheet } from '@react-pdf/renderer'

export type IplReportPdfView = {
  yearMonth: string
  residences: { id: string; name: string; incomeIdr: number }[]
  expenses: { id: string; category: string; amountIdr: number }[]
  saldoTotalIdr: number
  keterangan: string
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11 },
  title: { fontSize: 16, marginBottom: 12 },
  line: { marginBottom: 6 },
})

function IplReportDocument({ report }: { report: IplReportPdfView }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Laporan IPL {report.yearMonth}</Text>
        {report.residences.map((r) => (
          <Text key={r.id} style={styles.line}>
            Pemasukan IPL {r.name}: {r.incomeIdr}
          </Text>
        ))}
        {report.expenses.map((e) => (
          <Text key={e.id} style={styles.line}>
            Pengeluaran {e.category}: {e.amountIdr}
          </Text>
        ))}
        <Text style={styles.line}>Saldo total: {report.saldoTotalIdr}</Text>
        <Text style={styles.line}>Keterangan: {report.keterangan}</Text>
      </Page>
    </Document>
  )
}

export async function renderIplReportPdf(report: IplReportPdfView) {
  return renderToBuffer(<IplReportDocument report={report} />)
}
