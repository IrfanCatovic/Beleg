import type { TipAkcije } from '../types/akcija'

export interface AkcijaZaRanking {
  tipAkcije?: TipAkcije
  duzinaStazeKm?: number
  kumulativniUsponM?: number
  visinaVrhM?: number
  zimskiUspon?: boolean
  tezina?: string
  datum?: string
}

function tezinaToKategorija(raw?: string): number {
  const k = (raw ?? '').toLowerCase()
  if (k.includes('alpin')) return 4
  if (k.includes('tešk') || k.includes('tesk')) return 3
  if (k.includes('sred')) return 2
  if (k.includes('lak')) return 1
  return 1
}

function computePERForTura(tura: {
  km: number
  uspon_m: number
  zimski: boolean
  tezinaKategorija: number
  visinaVrha: number
  datum?: string
}): number {
  const base = tura.km * 10 + tura.uspon_m / 100 + tura.tezinaKategorija * 15
  const winterBonus = tura.zimski ? base * 0.15 : 0
  const heightBonus = tura.visinaVrha > 2000 ? (tura.visinaVrha - 2000) / 200 : 0
  return Math.round(base + winterBonus + heightBonus)
}

export function computePERForAkcija(a: AkcijaZaRanking): number {
  if (a.tipAkcije === 'via_ferrata') return 0
  return computePERForTura({
    km: a.duzinaStazeKm ?? 0,
    uspon_m: a.kumulativniUsponM ?? 0,
    zimski: a.zimskiUspon ?? false,
    tezinaKategorija: tezinaToKategorija(a.tezina),
    visinaVrha: a.visinaVrhM ?? 0,
    datum: a.datum,
  })
}
