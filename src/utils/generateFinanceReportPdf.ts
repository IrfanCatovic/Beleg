import html2pdf from 'html2pdf.js'

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
`

export function generateFinanceReportPdf(data: FinanceReportData): void {
  const fromStr = formatDateShort(data.from)
  const toStr = formatDateShort(data.to)

  const rows = data.transakcije.map((t) => {
    const opis = [t.opis, t.clanarinaKorisnik?.fullName || t.clanarinaKorisnik?.username].filter(Boolean).join(' – ') || '—'
    const uplata = t.tip === 'uplata' ? t.iznos.toLocaleString('sr-RS') : ''
    const isplata = t.tip === 'isplata' ? t.iznos.toLocaleString('sr-RS') : ''
    return `
      <tr>
        <td>${escapeHtml(formatDateShort(t.datum))}</td>
        <td>${escapeHtml(opis)}</td>
        <td class="num uplata">${escapeHtml(uplata)}</td>
        <td class="num isplata">${escapeHtml(isplata)}</td>
      </tr>
    `
  }).join('')

  const uplateStr = data.uplate.toLocaleString('sr-RS')
  const isplateStr = data.isplate.toLocaleString('sr-RS')
  const saldoClass = data.saldo >= 0 ? 'saldo-row' : 'saldo-row saldo-negative'
  const saldoStr = data.saldo.toLocaleString('sr-RS')

  const content = `
    <style>${pdfStyles}</style>
    <div class="fin-pdf">
      <div class="header">
        <h1>Finansijski izveštaj</h1>
        <p class="period">Period: ${escapeHtml(fromStr)} – ${escapeHtml(toStr)}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th>Opis</th>
            <th class="num">Uplata (RSD)</th>
            <th class="num">Isplata (RSD)</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="4">Nema transakcija u periodu.</td></tr>'}
          <tr class="total-row">
            <td colspan="2">Ukupno uplate</td>
            <td class="num uplata">${escapeHtml(uplateStr)}</td>
            <td class="num"></td>
          </tr>
          <tr class="total-row">
            <td colspan="2">Ukupno isplate</td>
            <td class="num"></td>
            <td class="num isplata">${escapeHtml(isplateStr)}</td>
          </tr>
          <tr class="${saldoClass}">
            <td colspan="2">Konačna suma (saldo)</td>
            <td class="num" colspan="2">${escapeHtml(saldoStr)} RSD</td>
          </tr>
        </tbody>
      </table>
    </div>
  `

  const wrapper = document.createElement('div')
  wrapper.innerHTML = content
  wrapper.style.cssText = `
    position: fixed; left: -9999px; top: 0;
    width: 210mm; min-height: 297mm; background: white;
    pointer-events: none;
  `
  document.body.appendChild(wrapper)

  const target = wrapper.querySelector('.fin-pdf') as HTMLElement
  if (!target) {
    document.body.removeChild(wrapper)
    console.error('PDF: nije pronađen sadržaj')
    return
  }

  const safeFrom = data.from.replace(/\D/g, '-')
  const safeTo = data.to.replace(/\D/g, '-')
  const options = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: `finansijski-izvestaj-${safeFrom}-${safeTo}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', hotfixes: ['px_scaling'] },
  }

  const cleanup = () => {
    if (wrapper.parentNode) document.body.removeChild(wrapper)
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      html2pdf()
        .set(options)
        .from(target)
        .save()
        .then(cleanup)
        .catch((err: unknown) => {
          cleanup()
          console.error('PDF greška:', err)
        })
    })
  })
}
