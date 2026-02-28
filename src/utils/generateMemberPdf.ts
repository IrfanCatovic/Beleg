import html2pdf from 'html2pdf.js'

/** Ime planinarskog društva/kluba za zaglavlje PDF-a */
export const PDF_CLUB_NAME = 'Ime kluba'

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
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatPol(pol: string | undefined): string {
  if (!pol) return ''
  if (pol === 'M') return 'Muški'
  if (pol === 'Ž') return 'Ženski'
  return pol
}

function val(value: string | null | undefined): string {
  const s = String(value ?? '').trim()
  return s || ''
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td class="label">${escapeHtml(label)}:</td>
      <td class="value">${escapeHtml(value)}</td>
    </tr>
  `
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
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

export function generateMemberPdf(data: MemberPdfData): void {
  const content = `
    <style>
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
    </style>
    <div class="pdf-wrap">
      <div class="header">
        <h1>EVIDENCIJA ČLANA</h1>
        <p>Planinarsko društvo ${escapeHtml(data.clubName || PDF_CLUB_NAME)}</p>
      </div>

      ${section('Lični podaci', `
        ${row('Ime i prezime', val(data.fullName))}
        ${row('Ime roditelja', val(data.ime_roditelja))}
        ${row('Pol', formatPol(data.pol))}
        ${row('Datum rođenja', formatDate(data.datum_rodjenja ?? undefined))}
        ${row('Državljanstvo', val(data.drzavljanstvo))}
        ${row('Adresa', val(data.adresa))}
        ${row('Telefon', val(data.telefon))}
        ${row('Email', val(data.email))}
      `)}

      ${section('Planinarski podaci', `
        ${row('Datum učlanjenja', formatDate(data.datum_uclanjenja ?? undefined))}
        ${row('Broj ličnog dokumenta', val(data.broj_licnog_dokumenta))}
        ${row('Broj planinarske legitimacije', val(data.broj_planinarske_legitimacije))}
        ${row('Broj planinarske markice', val(data.broj_planinarske_markice))}
      `)}

      ${section('Napomene i ostalo', `
        ${row('Izrečene disciplinske kazne', val(data.izrecene_disciplinske_kazne))}
        ${row('Izbor u organe sportskog udruženja', val(data.izbor_u_organe_sportskog_udruzenja))}
        ${row('Napomene', val(data.napomene))}
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
    console.error('PDF: nije pronađen sadržaj')
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
          console.error('PDF greška:', err)
        })
    })
  })
}
