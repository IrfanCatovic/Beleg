import type { WizardFerrataOption, WizardValues } from '../../pages/protected/action/ActionWizardForm'
import { ferrataAverageDurationHours } from './guideBookingActionPrefill'

function formatDuzinaKm(duzinaM: number): string {
  const km = (duzinaM ?? 0) / 1000
  return String(km)
}

export function normalizeFerrataSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'dj')
}

export function filterFerrataCatalog(catalog: WizardFerrataOption[], query: string): WizardFerrataOption[] {
  const q = normalizeFerrataSearch(query.trim())
  if (!q) return catalog.slice(0, 12)
  return catalog
    .filter((row) => {
      const hay = normalizeFerrataSearch(
        [row.naziv, row.drzava, row.gradOpstina, row.lokacija, row.tezina].filter(Boolean).join(' '),
      )
      return hay.includes(q)
    })
    .slice(0, 12)
}

export function buildWizardPatchFromFerrataRow(
  row: WizardFerrataOption,
  prev: Pick<WizardValues, 'naziv' | 'opis' | 'vrh'>,
  opts?: { fillNaziv?: boolean; fillOpis?: boolean },
): Partial<WizardValues> {
  const patch: Partial<WizardValues> = {
    ferrataId: String(row.id),
    tezina: row.tezina,
    planina: (row.drzava || '').trim() || 'Via ferrata',
    vrh: row.naziv,
    kumulativniUsponM: String(row.visinskaRazlikaM ?? 0),
    duzinaStazeKm: formatDuzinaKm(row.duzinaM ?? 0),
    trajanjeSati: ferrataAverageDurationHours(row),
  }

  const shouldFillNaziv = opts?.fillNaziv !== false
  if (shouldFillNaziv) {
    const prevNaziv = prev.naziv.trim()
    const prevVrh = prev.vrh.trim()
    if (!prevNaziv || prevNaziv === prevVrh) {
      patch.naziv = row.naziv
    }
  }

  const shouldFillOpis = opts?.fillOpis !== false
  if (shouldFillOpis && !prev.opis.trim()) {
    const tip = row.quickTip?.trim()
    const desc = row.opis?.trim()
    if (tip) patch.opis = tip
    else if (desc) patch.opis = desc.length > 600 ? `${desc.slice(0, 597)}…` : desc
  }

  return patch
}

export function ferrataCatalogFromApiRow(r: {
  id: number
  naziv: string
  tezina: string
  drzava?: string
  gradOpstina?: string
  lokacija?: string
  duzinaM: number
  visinskaRazlikaM: number
  trajanjeMin: number
  trajanjeMax: number
  opis?: string
  quickTip?: string
}): WizardFerrataOption {
  return {
    id: r.id,
    naziv: r.naziv,
    tezina: r.tezina,
    drzava: r.drzava,
    gradOpstina: r.gradOpstina,
    lokacija: r.lokacija,
    duzinaM: r.duzinaM,
    visinskaRazlikaM: r.visinskaRazlikaM,
    trajanjeMin: Number(r.trajanjeMin ?? 0),
    trajanjeMax: Number(r.trajanjeMax ?? 0),
    opis: r.opis,
    quickTip: r.quickTip,
  }
}
