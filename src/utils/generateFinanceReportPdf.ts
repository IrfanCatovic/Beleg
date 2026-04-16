import html2pdf from 'html2pdf.js'
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

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function formatDateShort(value: string): string {
  const d = new Date(value)
  return isNaN(d.getTime()) ? value : d.toLocaleDateString('sr-RS')
}

/** Broj redova tabele po stranici – cela tabela se zatvara i na novoj stranici počinje nova da se red ne prekida. */
const ROWS_PER_PAGE = 26

const pdfStyles = `
  .fin-pdf { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10pt; color: #111; line-height: 1.4; padding: 20px; background: white; }
  .fin-pdf .header { text-align: center; margin-bottom: 20px; }
  .fin-pdf .header h1 { font-size: 18pt; font-weight: bold; color: #1a1a1a; }
  .fin-pdf .header .period { font-size: 11pt; color: #555; margin-top: 4px; }
  .fin-pdf table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .fin-pdf th { text-align: left; padding: 8px 10px; background: #f5f5f5; font-weight: 600; color: #333; border: 1px solid #e0e0e0; }
  .fin-pdf td { padding: 6px 10px; border: 1px solid #e8e8e8; }
  .fin-pdf .num { text-align: right; }
  .fin-pdf .uplata { color: #15803d; }
  .fin-pdf .isplata { color: #b91c1c; }
  .fin-pdf .total-row { font-weight: bold; background: #f9f9f9; }
  .fin-pdf .saldo-row { font-weight: bold; font-size: 11pt; background: #e8f5e9; }
  .fin-pdf .saldo-negative { background: #ffebee; color: #b91c1c; }
  .fin-pdf .totals-wrapper { page-break-inside: avoid; break-inside: avoid; }
  .fin-pdf .totals-wrapper table { width: 100%; }
  .fin-pdf .table-chunk { page-break-inside: avoid; break-inside: avoid; }
  .fin-pdf .table-chunk.page-break-before { page-break-before: always; break-before: page; }
`

function buildTransactionRows(transakcije: FinanceReportTransakcija[], currency: string): string {
  if (transakcije.length === 0) {
    return `<tr><td colspan="4">${i18n.t('pdf:finance.noTransactions')}</td></tr>`
  }
  return transakcije.map((t) => {
    const opis = [t.opis, t.clanarinaKorisnik?.fullName || t.clanarinaKorisnik?.username].filter(Boolean).join(' – ') || '—'
    const uplata = t.tip === 'uplata' ? `${t.iznos.toLocaleString('sr-RS')} ${currency}` : ''
    const isplata = t.tip === 'isplata' ? `-${Math.abs(t.iznos).toLocaleString('sr-RS')} ${currency}` : ''
    return `
      <tr>
        <td>${escapeHtml(formatDateShort(t.datum))}</td>
        <td>${escapeHtml(opis)}</td>
        <td class="num uplata">${escapeHtml(uplata)}</td>
        <td class="num isplata">${escapeHtml(isplata)}</td>
      </tr>
    `
  }).join('')
}

function tableHeader(currency: string): string {
  return `
        <thead>
          <tr>
            <th>${i18n.t('pdf:finance.date')}</th>
            <th>${i18n.t('pdf:finance.description')}</th>
            <th class="num">${i18n.t('pdf:finance.income')} (${currency})</th>
            <th class="num">${i18n.t('pdf:finance.expense')} (${currency})</th>
          </tr>
        </thead>
`
}

export function generateFinanceReportPdf(data: FinanceReportData): void {
  const currency = data.currency || 'RSD'
  const fromStr = formatDateShort(data.from)
  const toStr = formatDateShort(data.to)

  const chunks: FinanceReportTransakcija[][] = []
  for (let i = 0; i < data.transakcije.length; i += ROWS_PER_PAGE) {
    chunks.push(data.transakcije.slice(i, i + ROWS_PER_PAGE))
  }
  if (chunks.length === 0) {
    chunks.push([])
  }

  const tablesHtml = chunks.map((chunk, index) => {
    const chunkClass = index === 0 ? 'table-chunk' : 'table-chunk page-break-before'
    return `
      <div class="${chunkClass}">
        <table>
          ${tableHeader(currency)}
          <tbody>
            ${buildTransactionRows(chunk, currency)}
          </tbody>
        </table>
      </div>
    `
  }).join('')

  const uplateStr = `${data.uplate.toLocaleString('sr-RS')} ${currency}`
  const isplateStr = data.isplate === 0 ? `0 ${currency}` : `-${data.isplate.toLocaleString('sr-RS')} ${currency}`
  const saldoClass = data.saldo >= 0 ? 'saldo-row' : 'saldo-row saldo-negative'
  const saldoStr = `${data.saldo.toLocaleString('sr-RS')} ${currency}`

  const content = `
    <style>${pdfStyles}</style>
    <div class="fin-pdf">
      <div class="header">
        <h1>${i18n.t('pdf:finance.title')}</h1>
        <p class="period">${i18n.t('pdf:finance.period')}: ${escapeHtml(fromStr)} – ${escapeHtml(toStr)}</p>
      </div>
      ${tablesHtml}
      <div class="totals-wrapper">
      <table>
        <tbody>
          <tr class="total-row">
            <td colspan="2">${i18n.t('pdf:finance.totalIncome')}</td>
            <td class="num uplata">${escapeHtml(uplateStr)}</td>
            <td class="num"></td>
          </tr>
          <tr class="total-row">
            <td colspan="2">${i18n.t('pdf:finance.totalExpense')}</td>
            <td class="num"></td>
            <td class="num isplata">${escapeHtml(isplateStr)}</td>
          </tr>
          <tr class="${saldoClass}">
            <td colspan="2">${i18n.t('pdf:finance.currentBalance')}</td>
            <td class="num" colspan="2">${escapeHtml(saldoStr)}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  `

  const wrapper = document.createElement('div')
  wrapper.innerHTML = content
  wrapper.style.cssText = `
    position: fixed; left: 0; top: 0;
    transform: translateX(-220vw);
    width: 210mm; min-height: 297mm; background: white;
    pointer-events: none;
    z-index: -1;
  `
  document.body.appendChild(wrapper)

  const target = wrapper.querySelector('.fin-pdf') as HTMLElement
  if (!target) {
    document.body.removeChild(wrapper)
    console.error(i18n.t('pdf:errors.contentMissing'))
    return
  }

  const safeFrom = data.from.replace(/\D/g, '-')
  const safeTo = data.to.replace(/\D/g, '-')
  const options = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: `${i18n.t('pdf:finance.filePrefix')}-${safeFrom}-${safeTo}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', hotfixes: ['px_scaling'] },
  }

  const cleanup = () => {
    if (wrapper.parentNode) document.body.removeChild(wrapper)
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        html2pdf()
          .set(options)
          .from(target)
          .save()
          .then(cleanup)
          .catch((err: unknown) => {
            cleanup()
            console.error(i18n.t('pdf:errors.generic'), err)
          })
      }, 60)
    })
  })
}
