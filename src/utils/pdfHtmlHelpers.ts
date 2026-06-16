export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export function val(value: string | null | undefined): string {
  const s = String(value ?? '').trim()
  return s || ''
}

export function formatPdfDate(value: string | null | undefined, locale = 'sr-Latn-RS'): string {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

export function pdfRow(label: string, value: string): string {
  return `
    <tr>
      <td class="label">${escapeHtml(label)}:</td>
      <td class="value">${escapeHtml(value)}</td>
    </tr>
  `
}

export function pdfSection(title: string, rows: string): string {
  return `
    <div class="section">
      <h2 class="section-title">${escapeHtml(title)}</h2>
      <table class="section-table">
        ${rows}
      </table>
    </div>
  `
}

export const standardPdfStyles = `
  .pdf-wrap { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11pt; color: #111; line-height: 1.5; padding: 24px; background: white; min-width: 180mm; }
  .pdf-wrap .header { text-align: center; margin-bottom: 28px; }
  .pdf-wrap .header h1 { font-size: 20pt; font-weight: bold; color: #1a1a1a; }
  .pdf-wrap .header p { font-size: 10pt; color: #555; margin-top: 4px; }
  .pdf-wrap .section { margin-bottom: 22px; }
  .pdf-wrap .section-title { font-size: 13pt; font-weight: bold; color: #417c53; margin-bottom: 10px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
  .pdf-wrap .section-table { width: 100%; border-collapse: collapse; }
  .pdf-wrap .section-table td { padding: 6px 0; vertical-align: top; border-bottom: 1px solid #f0f0f0; }
  .pdf-wrap .section-table td.label { font-weight: bold; width: 240px; color: #333; }
  .pdf-wrap .section-table td.value { color: #111; padding-left: 16px; }
  .pdf-wrap .signature-block { margin-top: 32px; text-align: right; }
  .pdf-wrap .signature-label { font-size: 10pt; color: #333; margin-bottom: 8px; }
  .pdf-wrap .signature-line { border-bottom: 1px solid #333; width: 180px; height: 28px; margin-left: auto; display: block; }
`
