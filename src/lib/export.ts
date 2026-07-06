import jsPDF from 'jspdf'
import 'jspdf-autotable'

export interface ExportRow {
  order: number
  saintName: string
  fullName: string
  gender: string
  dob: string
}

export interface PdfClassMeta {
  className: string
  catechistNames: string
  studentCount: number
}

export function exportCsv(rows: Array<ExportRow>, filename: string) {
  const headers = ['STT', 'Saint Name', 'Full Name', 'Gender', 'Date of Birth']
  const csvContent = [
    '\ufeff' + headers.join(','),
    ...rows.map((r) =>
      [r.order, `"${r.saintName}"`, `"${r.fullName}"`, `"${r.gender}"`, `"${r.dob}"`].join(','),
    ),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, filename)
}

export function exportPdf(rows: Array<ExportRow>, meta: PdfClassMeta, filename: string) {
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.text(meta.className, 14, 20)

  doc.setFontSize(11)
  doc.text(`Catechists: ${meta.catechistNames}`, 14, 30)
  doc.text(`Total Students: ${meta.studentCount}`, 14, 37)

  doc.autoTable({
    startY: 45,
    head: [['STT', 'Saint Name', 'Full Name', 'Gender', 'Date of Birth']],
    body: rows.map((r) => [r.order, r.saintName, r.fullName, r.gender, r.dob]),
  })

  doc.save(filename)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}