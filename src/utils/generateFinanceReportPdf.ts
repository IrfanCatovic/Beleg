import { jsPDF } from 'jspdf'
import i18n from '../i18n'

export interface FinanceReportTransakcija {
  datum: string
  tip: string
  iznos: number
  opis?: string
  clanarinaKorisnik?: { fullName?: string; username?: string }
}

export interface FinanceReportData {
  from: string
  to: string
  transakcije: FinanceReportTransakcija[]
  uplate: number
  isplate: number
  saldo: number
  currency?: 'RSD' | 'BAM' | 'HRK' | 'EUR'
}

function formatDateShort(value: string): string {
  const d = new Date(value)
  return isNaN(d.getTime()) ? value : d.toLocaleDateString('sr-RS')
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN_X = 12
const MARGIN_TOP = 12
const MARGIN_BOTTOM = 12
const TABLE_TOP_OFFSET = 26
const COL_DATE = 28
const COL_DESC = 82
const COL_INCOME = 38
const COL_EXPENSE = 38
const TABLE_WIDTH = COL_DATE + COL_DESC + COL_INCOME + COL_EXPENSE

function toPdfText(value: string): string {
  return value
    .replace(/đ/g, 'dj')
    .replace(/Đ/g, 'Dj')
    .replace(/[čć]/g, 'c')
    .replace(/[ČĆ]/g, 'C')
    .replace(/š/g, 's')
    .replace(/Š/g, 'S')
    .replace(/ž/g, 'z')
    .replace(/Ž/g, 'Z')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
}

function drawHeader(pdf: jsPDF, from: string, to: string): number {
  const fromStr = formatDateShort(from)
  const toStr = formatDateShort(to)
  const centerX = PAGE_WIDTH / 2
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.text(toPdfText(i18n.t('pdf:finance.title')), centerX, MARGIN_TOP, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  const periodText = `${i18n.t('pdf:finance.period')}: ${fromStr} - ${toStr}`
  pdf.text(toPdfText(periodText), centerX, MARGIN_TOP + 6, { align: 'center' })
  return MARGIN_TOP + TABLE_TOP_OFFSET
}

function drawTableHeader(pdf: jsPDF, y: number, currency: string): number {
  const x = MARGIN_X
  const h = 8
  pdf.setFillColor(245, 245, 245)
  pdf.rect(x, y, TABLE_WIDTH, h, 'F')
  pdf.setDrawColor(210, 210, 210)
  pdf.rect(x, y, TABLE_WIDTH, h)
  pdf.line(x + COL_DATE, y, x + COL_DATE, y + h)
  pdf.line(x + COL_DATE + COL_DESC, y, x + COL_DATE + COL_DESC, y + h)
  pdf.line(x + COL_DATE + COL_DESC + COL_INCOME, y, x + COL_DATE + COL_DESC + COL_INCOME, y + h)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text(toPdfText(i18n.t('pdf:finance.date')), x + 2, y + 5.3)
  pdf.text(toPdfText(i18n.t('pdf:finance.description')), x + COL_DATE + 2, y + 5.3)
  pdf.text(toPdfText(`${i18n.t('pdf:finance.income')} (${currency})`), x + COL_DATE + COL_DESC + COL_INCOME - 2, y + 5.3, { align: 'right' })
  pdf.text(toPdfText(`${i18n.t('pdf:finance.expense')} (${currency})`), x + TABLE_WIDTH - 2, y + 5.3, { align: 'right' })
  return y + h
}

export function generateFinanceReportPdf(data: FinanceReportData): void {
  const currency = data.currency || 'RSD'
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = drawHeader(pdf, data.from, data.to)
  y = drawTableHeader(pdf, y, currency)

  const rowBottomLimit = PAGE_HEIGHT - MARGIN_BOTTOM - 28
  const x = MARGIN_X
  pdf.setFontSize(8.8)

  if (data.transakcije.length === 0) {
    pdf.setFont('helvetica', 'normal')
    pdf.text(toPdfText(i18n.t('pdf:finance.noTransactions')), x + 2, y + 6)
    y += 10
  } else {
    for (const tx of data.transakcije) {
      const opis = [tx.opis, tx.clanarinaKorisnik?.fullName || tx.clanarinaKorisnik?.username].filter(Boolean).join(' - ') || '-'
      const income = tx.tip === 'uplata' ? `${Math.abs(tx.iznos).toLocaleString('sr-RS')} ${currency}` : ''
      const expense = tx.tip === 'isplata' ? `-${Math.abs(tx.iznos).toLocaleString('sr-RS')} ${currency}` : ''
      const dateText = toPdfText(formatDateShort(tx.datum))
      const descLines = pdf.splitTextToSize(toPdfText(opis), COL_DESC - 3) as string[]
      const rowHeight = Math.max(7, descLines.length * 4.4 + 2)

      if (y + rowHeight > rowBottomLimit) {
        pdf.addPage()
        y = drawHeader(pdf, data.from, data.to)
        y = drawTableHeader(pdf, y, currency)
        pdf.setFontSize(8.8)
      }

      pdf.setDrawColor(228, 228, 228)
      pdf.rect(x, y, TABLE_WIDTH, rowHeight)
      pdf.line(x + COL_DATE, y, x + COL_DATE, y + rowHeight)
      pdf.line(x + COL_DATE + COL_DESC, y, x + COL_DATE + COL_DESC, y + rowHeight)
      pdf.line(x + COL_DATE + COL_DESC + COL_INCOME, y, x + COL_DATE + COL_DESC + COL_INCOME, y + rowHeight)

      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(25, 25, 25)
      pdf.text(dateText, x + 2, y + 4.8)
      pdf.text(descLines, x + COL_DATE + 2, y + 4.8)

      if (income) {
        pdf.setTextColor(21, 128, 61)
        pdf.text(toPdfText(income), x + COL_DATE + COL_DESC + COL_INCOME - 2, y + 4.8, { align: 'right' })
      }
      if (expense) {
        pdf.setTextColor(185, 28, 28)
        pdf.text(toPdfText(expense), x + TABLE_WIDTH - 2, y + 4.8, { align: 'right' })
      }

      pdf.setTextColor(25, 25, 25)
      y += rowHeight
    }
  }

  if (y + 24 > PAGE_HEIGHT - MARGIN_BOTTOM) {
    pdf.addPage()
    y = drawHeader(pdf, data.from, data.to)
  }

  const totalsX = MARGIN_X
  const totalsW = TABLE_WIDTH
  const rowH = 8
  const uplateStr = `${data.uplate.toLocaleString('sr-RS')} ${currency}`
  const isplateStr = data.isplate === 0 ? `0 ${currency}` : `-${data.isplate.toLocaleString('sr-RS')} ${currency}`
  const saldoStr = `${data.saldo.toLocaleString('sr-RS')} ${currency}`
  const labelW = COL_DATE + COL_DESC

  pdf.setDrawColor(210, 210, 210)
  pdf.setFillColor(249, 249, 249)
  pdf.rect(totalsX, y, totalsW, rowH * 2, 'FD')
  pdf.line(totalsX, y + rowH, totalsX + totalsW, y + rowH)
  pdf.line(totalsX + labelW, y, totalsX + labelW, y + rowH * 2)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9.5)
  pdf.setTextColor(30, 30, 30)
  pdf.text(toPdfText(i18n.t('pdf:finance.totalIncome')), totalsX + 2, y + 5.2)
  pdf.text(toPdfText(i18n.t('pdf:finance.totalExpense')), totalsX + 2, y + rowH + 5.2)
  pdf.setTextColor(21, 128, 61)
  pdf.text(toPdfText(uplateStr), totalsX + totalsW - 2, y + 5.2, { align: 'right' })
  pdf.setTextColor(185, 28, 28)
  pdf.text(toPdfText(isplateStr), totalsX + totalsW - 2, y + rowH + 5.2, { align: 'right' })

  y += rowH * 2

  pdf.setDrawColor(200, 200, 200)
  if (data.saldo >= 0) {
    pdf.setFillColor(232, 245, 233)
  } else {
    pdf.setFillColor(255, 235, 238)
  }
  pdf.rect(totalsX, y, totalsW, rowH, 'FD')
  pdf.line(totalsX + labelW, y, totalsX + labelW, y + rowH)

  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(30, 30, 30)
  pdf.text(toPdfText(i18n.t('pdf:finance.currentBalance')), totalsX + 2, y + 5.2)
  pdf.setTextColor(data.saldo >= 0 ? 21 : 185, data.saldo >= 0 ? 128 : 28, data.saldo >= 0 ? 61 : 28)
  pdf.text(toPdfText(saldoStr), totalsX + totalsW - 2, y + 5.2, { align: 'right' })

  const safeFrom = data.from.replace(/\D/g, '-')
  const safeTo = data.to.replace(/\D/g, '-')
  pdf.save(`${i18n.t('pdf:finance.filePrefix')}-${safeFrom}-${safeTo}.pdf`)
}
