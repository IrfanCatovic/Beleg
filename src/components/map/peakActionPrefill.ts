/** DTO vrha sa /api/peaks/:id (peakToMap na backendu). */
export type PeakDTO = {
  id: number
  naziv: string
  planina?: string
  slug?: string
  visinaM?: number
  lat?: number | null
  lng?: number | null
  drzava?: string
  grad?: string
  opis?: string
}

/** Patch za formu kreiranja akcije, izveden iz podataka vrha. */
export type PeakActionPrefill = {
  planina: string
  vrh: string
  visinaVrhM: string
  planinaLat: string
  planinaLng: string
  naziv: string
  opis: string
}

function num(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function peakActionPrefillFrom(peak: PeakDTO): PeakActionPrefill {
  const nazivVrha = (peak.naziv ?? '').trim()
  const lat = num(peak.lat)
  const lng = num(peak.lng)
  const visina = num(peak.visinaM)
  return {
    planina: (peak.planina ?? '').trim(),
    vrh: nazivVrha,
    visinaVrhM: visina != null && visina > 0 ? String(Math.round(visina)) : '',
    planinaLat: lat != null ? String(lat) : '',
    planinaLng: lng != null ? String(lng) : '',
    naziv: nazivVrha ? `Uspon na ${nazivVrha}` : '',
    opis: (peak.opis ?? '').trim(),
  }
}
