import html2pdf from 'html2pdf.js'
import i18n from '../i18n'
import {
  escapeHtml,
  formatPdfDate,
  pdfRow as row,
  pdfSection as section,
  standardPdfStyles,
  val,
} from './pdfHtmlHelpers'

export interface MemberPdfData {
  clubName?: string
  fullName?: string
  ime_roditelja?: string
  pol?: string
  datum_rodjenja?: string | null
  drzavljanstvo?: string
  adresa?: string
  telefon?: string
  email?: string
  datum_uclanjenja?: string | null
  broj_licnog_dokumenta?: string
  broj_planinarske_legitimacije?: string
  broj_planinarske_markice?: string
  izrecene_disciplinske_kazne?: string
  izbor_u_organe_sportskog_udruzenja?: string
  napomene?: string
}

function formatDate(value: string | null | undefined): string {
  return formatPdfDate(value, 'sr-RS')
}

function formatPol(pol: string | undefined): string {
  if (!pol) return ''
  if (pol === 'M') return i18n.t('pdf:member.genderMale')
  if (pol === 'Ž') return i18n.t('pdf:member.genderFemale')
  return pol
}

export function generateMemberPdf(data: MemberPdfData): void {
  const clubName = data.clubName?.trim() || 'Planinarsko drustvo'
  const content = `
    <style>${standardPdfStyles}</style>
    <div class="pdf-wrap">
      <div class="header">
        <h1>${i18n.t('pdf:member.title')}</h1>
        <p>${escapeHtml(clubName)}</p>
      </div>

      ${section(i18n.t('pdf:member.sections.personal'), `
        ${row(i18n.t('pdf:member.fields.fullName'), val(data.fullName))}
        ${row(i18n.t('pdf:member.fields.parentName'), val(data.ime_roditelja))}
        ${row(i18n.t('pdf:member.fields.gender'), formatPol(data.pol))}
        ${row(i18n.t('pdf:member.fields.birthDate'), formatDate(data.datum_rodjenja ?? undefined))}
        ${row(i18n.t('pdf:member.fields.citizenship'), val(data.drzavljanstvo))}
        ${row(i18n.t('pdf:member.fields.address'), val(data.adresa))}
        ${row(i18n.t('pdf:member.fields.phone'), val(data.telefon))}
        ${row(i18n.t('pdf:member.fields.email'), val(data.email))}
      `)}

      ${section(i18n.t('pdf:member.sections.hiking'), `
        ${row(i18n.t('pdf:member.fields.membershipDate'), formatDate(data.datum_uclanjenja ?? undefined))}
        ${row(i18n.t('pdf:member.fields.idNumber'), val(data.broj_licnog_dokumenta))}
        ${row(i18n.t('pdf:member.fields.cardNumber'), val(data.broj_planinarske_legitimacije))}
        ${row(i18n.t('pdf:member.fields.badgeNumber'), val(data.broj_planinarske_markice))}
      `)}

      ${section(i18n.t('pdf:member.sections.notes'), `
        ${row(i18n.t('pdf:member.fields.disciplinary'), val(data.izrecene_disciplinske_kazne))}
        ${row(i18n.t('pdf:member.fields.selectionBodies'), val(data.izbor_u_organe_sportskog_udruzenja))}
        ${row(i18n.t('pdf:member.fields.notes'), val(data.napomene))}
      `)}
    </div>
  `

  const wrapper = document.createElement('div')
  wrapper.innerHTML = content
  // Ispod viewport-a da se ne vidi — html2canvas hvata element u DOM-u
  wrapper.style.cssText = `
    position: fixed; bottom: -400mm; left: 0;
    width: 210mm; min-height: 297mm; background: white;
    pointer-events: none;
  `
  document.body.appendChild(wrapper)

  const target = wrapper.querySelector('.pdf-wrap') as HTMLElement
  if (!target) {
    document.body.removeChild(wrapper)
    console.error(i18n.t('pdf:errors.contentMissing'))
    return
  }

  const options = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: `clan-${(data.fullName || 'evidencija').replace(/\s+/g, '-')}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', hotfixes: ['px_scaling'] },
  }

  const cleanup = () => {
    if (wrapper.parentNode) document.body.removeChild(wrapper)
  }

  // Kratko čekaj da se DOM i stilovi primene pre capture-a
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
