import html2pdf from 'html2pdf.js'
import i18n from '../i18n'

function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' })
}

function val(value: string | null | undefined): string {
  const s = String(value ?? '').trim()
  return s || ''
}

function formatTezinaLabel(tezina: string | null | undefined): string {
  const t = (tezina ?? '').toLowerCase().trim()
  if (t === 'lako') return 'Lako'
  if (t === 'srednje') return 'Srednje'
  if (t === 'tesko' || t === 'teško') return 'Teško'
  if (t === 'alpinizam') return 'Alpinizam'
  return val(tezina)
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td class="label">${escapeHtml(label)}:</td>
      <td class="value">${escapeHtml(value)}</td>
    </tr>
  `
}

function section(title: string, rows: string): string {
  return `
    <div class="section">
      <h2 class="section-title">${escapeHtml(title)}</h2>
      <table class="section-table">
        ${rows}
      </table>
    </div>
  `
}

const pdfStyles = `
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

function resolveClubName(clubName?: string): string {
  const name = clubName?.trim()
  return name && name.length > 0 ? name : 'Planinarsko drustvo'
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

function runPdf(wrapper: HTMLDivElement, filename: string): void {
  const target = wrapper.querySelector('.pdf-wrap') as HTMLElement
  if (!target) {
    if (wrapper.parentNode) document.body.removeChild(wrapper)
    console.error(i18n.t('pdf:errors.contentMissing'))
    return
  }
  const options = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', hotfixes: ['px_scaling'] as unknown as string[] },
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
          console.error(i18n.t('pdf:errors.generic'), err)
        })
    })
  })
}

/** Formular akcije – pre polaska (naziv, vrh, datum, opis, težina, vodič, ko je dodao, broj polaznika, imena). */
export function generateActionPdfPrePolaska(data: ActionPdfPrePolaskaData): void {
  const clubName = resolveClubName(data.clubName)
  const content = `
    <style>${pdfStyles}</style>
    <div class="pdf-wrap">
      <div class="header">
        <h1>${i18n.t('pdf:action.preDepartureTitle')}</h1>
        <p>${escapeHtml(clubName)}</p>
      </div>
      ${section(i18n.t('pdf:action.section'), `
        ${row(i18n.t('pdf:action.fields.name'), val(data.naziv))}
        ${data.planina ? row(i18n.t('pdf:action.fields.mountain'), val(data.planina)) : ''}
        ${row(i18n.t('pdf:action.fields.peak'), val(data.vrh))}
        ${row(i18n.t('pdf:action.fields.date'), formatDate(data.datum))}
        ${row(i18n.t('pdf:action.fields.description'), val(data.opis))}
        ${row(i18n.t('pdf:action.fields.difficulty'), formatTezinaLabel(data.tezina))}
        ${row(i18n.t('pdf:action.fields.guide'), val(data.vodicIme))}
        ${row(i18n.t('pdf:action.fields.addedBy'), val(data.addedBy))}
        ${row(i18n.t('pdf:action.fields.participantsCount'), String(data.brojPolaznika))}
        ${row(i18n.t('pdf:action.fields.participantsNames'), val(data.imenaPolaznika))}
      `)}
      <div class="signature-block">
        <div class="signature-label">${i18n.t('pdf:action.signature')}</div>
        <span class="signature-line"></span>
      </div>
    </div>
  `
  const wrapper = document.createElement('div')
  wrapper.innerHTML = content
  wrapper.style.cssText = 'position: fixed; bottom: -400mm; left: 0; width: 210mm; min-height: 297mm; background: white; pointer-events: none;'
  document.body.appendChild(wrapper)
  const safeName = (data.naziv || 'akcija').replace(/\s+/g, '-').replace(/[^\w\-]/g, '')
  runPdf(wrapper, `${i18n.t('pdf:action.preDepartureFile')}-${safeName}.pdf`)
}

/** Formular akcije – završena (naziv, vrh, datum, opis, težina, vodič, ko je dodao, broj prijavljenih / uspešno popeli, imena uspešnih). */
export function generateActionPdfZavrsena(data: ActionPdfZavrsenaData): void {
  const clubName = resolveClubName(data.clubName)
  const content = `
    <style>${pdfStyles}</style>
    <div class="pdf-wrap">
      <div class="header">
        <h1>${i18n.t('pdf:action.completedTitle')}</h1>
        <p>${escapeHtml(clubName)}</p>
      </div>
      ${section(i18n.t('pdf:action.section'), `
        ${row(i18n.t('pdf:action.fields.name'), val(data.naziv))}
        ${data.planina ? row(i18n.t('pdf:action.fields.mountain'), val(data.planina)) : ''}
        ${row(i18n.t('pdf:action.fields.peak'), val(data.vrh))}
        ${row(i18n.t('pdf:action.fields.date'), formatDate(data.datum))}
        ${row(i18n.t('pdf:action.fields.description'), val(data.opis))}
        ${row(i18n.t('pdf:action.fields.difficulty'), formatTezinaLabel(data.tezina))}
        ${row(i18n.t('pdf:action.fields.guide'), val(data.vodicIme))}
        ${row(i18n.t('pdf:action.fields.addedBy'), val(data.addedBy))}
        ${row(i18n.t('pdf:action.fields.successRatio'), `${data.brojUspesnoPopeli} / ${data.brojPrijavljenih}`)}
        ${row(i18n.t('pdf:action.fields.successNames'), val(data.imenaUspesnoPopeli))}
      `)}
      <div class="signature-block">
        <div class="signature-label">${i18n.t('pdf:action.signature')}</div>
        <span class="signature-line"></span>
      </div>
    </div>
  `
  const wrapper = document.createElement('div')
  wrapper.innerHTML = content
  wrapper.style.cssText = 'position: fixed; bottom: -400mm; left: 0; width: 210mm; min-height: 297mm; background: white; pointer-events: none;'
  document.body.appendChild(wrapper)
  const safeName = (data.naziv || 'akcija').replace(/\s+/g, '-').replace(/[^\w\-]/g, '')
  runPdf(wrapper, `${i18n.t('pdf:action.completedFile')}-${safeName}.pdf`)
}
