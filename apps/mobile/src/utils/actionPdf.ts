import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

const pdfStyles = `
  body { font-family: Helvetica, Arial, sans-serif; font-size: 11pt; color: #111; padding: 24px; }
  h1 { font-size: 18pt; text-align: center; }
  .sub { text-align: center; color: #555; margin-bottom: 20px; }
  .section-title { font-size: 13pt; font-weight: bold; color: #417c53; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; margin: 16px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 0; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  td.label { font-weight: bold; width: 40%; color: #333; }
  .signature { margin-top: 40px; text-align: right; }
  .line { display: inline-block; width: 180px; border-bottom: 1px solid #333; height: 28px; }
`

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString('sr-Latn-RS')
  } catch {
    return value
  }
}

function row(label: string, value: string): string {
  return `<tr><td class="label">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`
}

export interface ActionPdfPrePolaskaData {
  clubName?: string
  naziv: string
  planina?: string
  vrh: string
  datum: string
  opis: string
  tezina: string
  vodicIme: string
  addedBy: string
  brojPolaznika: number
  imenaPolaznika: string
}

export interface ActionPdfZavrsenaData {
  clubName?: string
  naziv: string
  planina?: string
  vrh: string
  datum: string
  opis: string
  tezina: string
  vodicIme: string
  addedBy: string
  brojPrijavljenih: number
  brojUspesnoPopeli: number
  imenaUspesnoPopeli: string
}

async function sharePdf(html: string, filename: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, base64: false })
  const canShare = await Sharing.isAvailableAsync()
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: filename })
  }
}

export async function generateActionPdfPrePolaska(data: ActionPdfPrePolaskaData): Promise<void> {
  const clubName = data.clubName?.trim() || 'Planinarsko društvo'
  const html = `
    <html><head><meta charset="utf-8"><style>${pdfStyles}</style></head><body>
      <h1>Akcija – pre polaska</h1>
      <p class="sub">${escapeHtml(clubName)}</p>
      <div class="section-title">Podaci</div>
      <table>
        ${row('Naziv', data.naziv)}
        ${data.planina ? row('Planina', data.planina) : ''}
        ${row('Vrh', data.vrh)}
        ${row('Datum', formatDate(data.datum))}
        ${row('Opis', data.opis)}
        ${row('Težina', data.tezina)}
        ${row('Vodič', data.vodicIme)}
        ${row('Dodao/la', data.addedBy)}
        ${row('Broj polaznika', String(data.brojPolaznika))}
        ${row('Imena polaznika', data.imenaPolaznika)}
      </table>
      <div class="signature"><div>Potpis</div><span class="line"></span></div>
    </body></html>
  `
  const safeName = (data.naziv || 'akcija').replace(/\s+/g, '-').replace(/[^\w\-]/g, '')
  await sharePdf(html, `akcija-pre-polaska-${safeName}.pdf`)
}

export async function generateActionPdfZavrsena(data: ActionPdfZavrsenaData): Promise<void> {
  const clubName = data.clubName?.trim() || 'Planinarsko društvo'
  const html = `
    <html><head><meta charset="utf-8"><style>${pdfStyles}</style></head><body>
      <h1>Akcija – završena</h1>
      <p class="sub">${escapeHtml(clubName)}</p>
      <div class="section-title">Podaci</div>
      <table>
        ${row('Naziv', data.naziv)}
        ${data.planina ? row('Planina', data.planina) : ''}
        ${row('Vrh', data.vrh)}
        ${row('Datum', formatDate(data.datum))}
        ${row('Opis', data.opis)}
        ${row('Težina', data.tezina)}
        ${row('Vodič', data.vodicIme)}
        ${row('Dodao/la', data.addedBy)}
        ${row('Uspešno / prijavljeni', `${data.brojUspesnoPopeli} / ${data.brojPrijavljenih}`)}
        ${row('Imena uspešnih', data.imenaUspesnoPopeli)}
      </table>
      <div class="signature"><div>Potpis</div><span class="line"></span></div>
    </body></html>
  `
  const safeName = (data.naziv || 'akcija').replace(/\s+/g, '-').replace(/[^\w\-]/g, '')
  await sharePdf(html, `akcija-zavrsena-${safeName}.pdf`)
}
