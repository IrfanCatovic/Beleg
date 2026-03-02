import html2pdf from 'html2pdf.js'
import type { AnnualReportRow } from './annualReportUtils'

const pdfStyles = `
  .ar-pdf { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11pt; color: #000; background: #fff; padding: 5mm 6mm 10mm 6mm; box-sizing: border-box; }
  .ar-pdf * { box-sizing: border-box; }
  .ar-header { display: flex; align-items: flex-start; margin-bottom: 12px; gap: 12px; }
  .ar-logo { flex-shrink: 0; width: 78px; height: 78px; object-fit: contain; }
  .ar-header-center { flex: 1; text-align: center; }
  .ar-header-center .org { font-size: 11pt; font-weight: bold; }
  .ar-header-center .commission { font-size: 10pt; margin-top: 2px; }
  .ar-header-center .title { font-size: 12pt; font-weight: bold; margin-top: 4px; }
  .ar-header-center .sub { font-size: 9pt; margin-top: 2px; color: #c00; font-weight: bold; }
  .ar-form-no { border: 1px solid #000; background: #f0f0f0; padding: 6px 10px; font-size: 10pt; flex-shrink: 0; }
  .ar-fields { margin: 14px 0 0; font-size: 11pt; }
  .ar-fields-between { border-top: 1px solid #000; min-height: 9mm; margin-top: 2px; padding-top: 4px; }
  .ar-fields-row { display: flex; gap: 24px; }
  .ar-fields-row .label { color: #000; font-weight: bold; margin-bottom: 0; }
  .ar-divider { border: none; border-top: 1px solid #000; margin: 0 0 8px; }
  .ar-table { width: 100%; border-collapse: collapse; font-size: 9pt; table-layout: fixed; }
  .ar-table thead { display: table-header-group; }
  .ar-table tbody tr { break-inside: avoid; page-break-inside: avoid; }
  .ar-table th, .ar-table td { border: 0.7px solid #000; padding: 8px 5px; vertical-align: middle; min-height: 32px; }
  .ar-table th { font-weight: bold; text-align: center; background: #fafafa; }
  .ar-table th.narrow { width: 30px; }
  .ar-table th.date { width: 72px; }
  .ar-table th.name { width: 25%; min-width: 64px; }
  .ar-table th.num { width: 24px; }
  .ar-table td:nth-child(1) { width: 30px; }
  .ar-table td:nth-child(2) { width: 25%; }
  .ar-table td:nth-child(3) { width: 72px; }
  .ar-table td:nth-child(n+4):not(:last-child) { width: 24px; }
  .ar-table th.total-col { width: 50px; line-height: 1.35; font-size: 9pt; }
  .ar-table td:last-child { width: 50px; }
  .ar-table td { min-height: 32px; text-align: center; }
  .ar-table th.name, .ar-table td:nth-child(2) { text-align: center; }
  .ar-signature { margin-top: 16px; text-align: right; }
  .ar-signature-text { font-size: 9pt; color: #333; margin-bottom: 14px; }
  .ar-signature-line { display: inline-block; width: 180px; border-bottom: 1px solid #000; height: 24px; }
`

/** Broj praznih redova kada se ne prosleđuju podaci (prazan obrazac). */
const EMPTY_ROW_COUNT = 42

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function formatDatum(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('sr-RS')
}

function emptyRowsHtml(): string {
  const rows: string[] = []
  for (let i = 1; i <= EMPTY_ROW_COUNT; i++) {
    rows.push(`
      <tr>
        <td class="row-num"></td>
        <td></td>
        <td></td>
        <td></td><td></td><td></td><td></td><td></td>
        <td></td><td></td><td></td><td></td><td></td>
        <td></td>
      </tr>
    `)
  }
  return rows.join('')
}

function dataRowsHtml(rows: AnnualReportRow[]): string {
  return rows
    .map((r) => {
      const c = r.counts
      return `
      <tr>
        <td class="row-num">${escapeHtml(String(r.rb))}</td>
        <td>${escapeHtml(r.nazivIMesto)}</td>
        <td>${escapeHtml(formatDatum(r.datum))}</td>
        <td>${c.mPodmladak}</td><td>${c.mJuniori}</td><td>${c.mSeniori}</td><td>${c.mVeterani}</td><td>${c.mUkupno}</td>
        <td>${c.zPodmladak}</td><td>${c.zJuniori}</td><td>${c.zSeniori}</td><td>${c.zVeterani}</td><td>${c.zUkupno}</td>
        <td>${c.ukupno}</td>
      </tr>
    `
    })
    .join('')
}

/**
 * Generiše PDF godišnjeg izveštaja o aktivnostima (Образац бр. 3).
 * Ako je prosleđen niz redova, tabela se puni tim podacima (R.Б. 1, 2, …); inače se štampa prazan obrazac.
 * Logo: /psslogo.png (public folder).
 */
export function generateAnnualReportPdf(rows?: AnnualReportRow[]): void {
  const tbodyContent = rows && rows.length > 0 ? dataRowsHtml(rows) : emptyRowsHtml()
  const content = `
    <style>${pdfStyles}</style>
    <div class="ar-pdf">
      <div class="ar-header">
        <img class="ar-logo" src="/psslogo.png" alt="PSS" />
        <div class="ar-header-center">
          <div class="org">Планинарски савез Србије – Mountaineering Association of Serbia</div>
          <div class="commission">Комисија за планинарење и пешачење (КПП)</div>
          <div class="title">ГОДИШЊИ ИЗВЕШТАЈ О АКТИВНОСТИ ПСО / КЛУБОВА</div>
          <div class="sub">(Попуњава ПСО / Клуб за све званично организоване клупске акције и доставља Начелништву ПСС)</div>
        </div>
        <div class="ar-form-no">Образац бр. 3</div>
      </div>

      <div class="ar-fields">
        <div class="ar-fields-between">
          <div class="ar-fields-row">
            <div style="flex: 1;"><span class="label">ПСО / Клуб:</span> Beleg</div>
            <div style="flex: 1;"><span class="label">Место:</span> Tutin</div>
          </div>
        </div>
      </div>
      <hr class="ar-divider" />

      <table class="ar-table">
        <thead>
          <tr>
            <th rowspan="2" class="narrow">R.Б.</th>
            <th rowspan="2" class="name">Назив и место одржавања акције</th>
            <th rowspan="2" class="date">Датум:</th>
            <th colspan="5">Број учесника – Мушкарци</th>
            <th colspan="5">Број учесника – Жене</th>
            <th rowspan="2" class="num total-col">Укупно<br>М+Ж</th>
          </tr>
          <tr>
            <th class="num">Подмл. до 10 год</th>
            <th class="num">Јуниори до 18 год</th>
            <th class="num">Сениори до 45 год</th>
            <th class="num">Ветерани од 45</th>
            <th class="num">Свега М</th>
            <th class="num">Подмл. до 10 год</th>
            <th class="num">Јуниори до 18 год</th>
            <th class="num">Сениори до 45 год</th>
            <th class="num">Ветерани од 45</th>
            <th class="num">Свега Ж</th>
          </tr>
        </thead>
        <tbody>
          ${tbodyContent}
        </tbody>
      </table>

      <div class="ar-signature">
        <div class="ar-signature-text">Тачност података оверава председник клуба (Потпис и печат)</div>
        <div class="ar-signature-line"></div>
      </div>
    </div>
  `

  const wrapper = document.createElement('div')
  wrapper.innerHTML = content
  wrapper.style.cssText =
    'position: fixed; bottom: -500mm; left: 0; width: 297mm; min-height: 210mm; background: white; pointer-events: none;'
  document.body.appendChild(wrapper)

  const target = wrapper.querySelector('.ar-pdf') as HTMLElement
  if (!target) {
    if (wrapper.parentNode) document.body.removeChild(wrapper)
    console.error('PDF: nije pronađen sadržaj')
    return
  }

  const options = {
    margin: [4, 4, 8, 4] as [number, number, number, number],
    filename: 'godisnji-izvestaj-aktivnosti-obrazac-3.pdf',
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'landscape',
      hotfixes: ['px_scaling'] as unknown as string[],
    },
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
