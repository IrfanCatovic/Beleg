import type { TipAkcije } from '../types/akcija'

export type TezinaKategorija = 'laka' | 'srednja' | 'teska' | 'alpinizam'

export interface Tura {
  km: number
  uspon_m: number
  zimski: boolean
  tezinaKategorija: TezinaKategorija
  visinaVrha: number
  datum: string | Date
}

export interface AkcijaZaRanking {
  id?: number
  tipAkcije?: TipAkcije
  duzinaStazeKm?: number
  kumulativniUsponM?: number
  visinaVrhM?: number
  zimskiUspon?: boolean
  tezina?: string
  datum?: string
}

const BONUS_CAP = 0.5

const TEZINA_BONUS: Record<TezinaKategorija, number> = {
  laka: 0,
  srednja: 0.05,
  teska: 0.1,
  alpinizam: 0.25,
}

function getVisinaVrhaBonus(visinaVrha: number): number {
  if (visinaVrha < 2000) return 0.01
  if (visinaVrha < 2500) return 0.02
  if (visinaVrha < 3000) return 0.04
  if (visinaVrha < 3500) return 0.06
  return 0.1
}

function perJedneTure(t: Tura): number {
  const baza = t.km * 1 + t.uspon_m * 0.04
  const tezinaProcenat = TEZINA_BONUS[t.tezinaKategorija]

  let ukupniBonus = 0
  ukupniBonus += t.zimski ? 0.15 : 0
  ukupniBonus += tezinaProcenat

  const visinaBonus = getVisinaVrhaBonus(t.visinaVrha)
  const kumulativniBonusRaw = Math.floor(t.uspon_m / 750) * 0.01
  const faktor = 1 + tezinaProcenat
  ukupniBonus += visinaBonus * faktor
  ukupniBonus += kumulativniBonusRaw * faktor
  ukupniBonus += Math.floor(t.uspon_m / 500) * 0.02
  ukupniBonus = Math.min(ukupniBonus, BONUS_CAP)

  return Math.round(baza * (1 + ukupniBonus))
}

export function computePER(ture: Tura[]): number {
  return ture.reduce((sum, t) => sum + perJedneTure(t), 0)
}

export function computePERForTura(t: Tura): number {
  return perJedneTure(t)
}

export const RANK_COLORS: Record<number, string> = {
  1: '#ccc4b1',
  2: '#556B2F',
  3: '#B7410E',
  4: '#8B0000',
  5: '#00CED1',
  6: '#000000',
}

export const RANK_NAMES: Record<number, string> = {
  1: 'Početnik',
  2: 'Istraživač',
  3: 'Sedlar',
  4: 'Osvajač',
  5: 'Oblakolovac',
  6: 'Legenda stijena',
}

const SEGMENT_ROMAN = ['I', 'II', 'III', 'IV', 'V'] as const
const PER_PER_MAIN_RANK = 500
const PER_PER_SEGMENT = 100

export interface RankResult {
  naziv: string
  boja: string
  per: number
  segment: number
  glavniRank: number
}

export function formatRankDisplayName(
  rank: RankResult,
  top30Position: number | null | undefined,
): string {
  if (rank.glavniRank === 6 && top30Position != null && top30Position >= 1 && top30Position <= 30) {
    return `Legenda stijena[${top30Position}]`
  }
  return rank.naziv
}

export function getRankFromPER(per: number): RankResult {
  const perClamped = Math.max(0, Math.floor(per))

  if (perClamped >= 2500) {
    return {
      naziv: RANK_NAMES[6],
      boja: RANK_COLORS[6],
      per: perClamped,
      segment: 0,
      glavniRank: 6,
    }
  }

  const glavniRank = Math.min(6, Math.floor(perClamped / PER_PER_MAIN_RANK) + 1)
  if (glavniRank <= 0) {
    return {
      naziv: `${RANK_NAMES[1]} I`,
      boja: RANK_COLORS[1],
      per: perClamped,
      segment: 1,
      glavniRank: 1,
    }
  }

  const perURanku = perClamped - (glavniRank - 1) * PER_PER_MAIN_RANK
  const segment = Math.min(5, Math.floor(perURanku / PER_PER_SEGMENT) + 1)
  const segmentClamped = Math.max(1, segment)
  const naziv =
    glavniRank <= 5
      ? `${RANK_NAMES[glavniRank]} ${SEGMENT_ROMAN[segmentClamped - 1]}`
      : RANK_NAMES[6]

  return {
    naziv,
    boja: RANK_COLORS[glavniRank],
    per: perClamped,
    segment: segmentClamped,
    glavniRank,
  }
}

export function mapAkcijaToTura(a: AkcijaZaRanking): Tura {
  if (a.tipAkcije === 'via_ferrata') {
    return {
      km: 0,
      uspon_m: 0,
      zimski: false,
      tezinaKategorija: 'laka',
      visinaVrha: 0,
      datum: a.datum ?? '',
    }
  }

  const tezina = (a.tezina ?? '').toLowerCase()
  let tezinaKategorija: TezinaKategorija = 'laka'
  if (tezina.includes('srednj') || tezina === 'srednje') tezinaKategorija = 'srednja'
  else if (tezina.includes('tešk') || tezina.includes('tesk')) tezinaKategorija = 'teska'
  else if (tezina.includes('alpin')) tezinaKategorija = 'alpinizam'

  return {
    km: a.duzinaStazeKm ?? 0,
    uspon_m: a.kumulativniUsponM ?? 0,
    zimski: a.zimskiUspon ?? false,
    tezinaKategorija,
    visinaVrha: a.visinaVrhM ?? 0,
    datum: a.datum ?? '',
  }
}

export function computePERForAkcija(a: AkcijaZaRanking): number {
  if (a.tipAkcije === 'via_ferrata') return 0
  return perJedneTure(mapAkcijaToTura(a))
}

/** Spaja osvojene i vođene akcije bez duplog brojanja iste akcije. */
export function mergeAkcijeZaRanking(
  uspesneAkcije: AkcijaZaRanking[] = [],
  vodeneAkcije: AkcijaZaRanking[] = [],
): AkcijaZaRanking[] {
  const byId = new Map<number, AkcijaZaRanking>()
  for (const a of uspesneAkcije) {
    if (a.id != null) byId.set(a.id, a)
  }
  for (const a of vodeneAkcije) {
    if (a.id != null && !byId.has(a.id)) byId.set(a.id, a)
  }
  const withoutId = [...uspesneAkcije, ...vodeneAkcije].filter((a) => a.id == null)
  return [...byId.values(), ...withoutId]
}

export function computeRank(statistika: {
  ture?: Tura[]
  uspesneAkcije?: AkcijaZaRanking[]
  vodeneAkcije?: AkcijaZaRanking[]
  ukupnoKm?: number
  ukupnoMetaraUspona?: number
}): RankResult {
  const mergedAkcije = mergeAkcijeZaRanking(
    statistika.uspesneAkcije,
    statistika.vodeneAkcije,
  )
  const ture =
    statistika.ture ??
    (mergedAkcije.length > 0 ? mergedAkcije.map(mapAkcijaToTura) : [])
  const usedFallback = ture.length === 0
  const per = usedFallback
    ? Math.round((statistika.ukupnoKm ?? 0) * 1 + (statistika.ukupnoMetaraUspona ?? 0) * 0.04)
    : computePER(ture)
  return getRankFromPER(per)
}

/** Zbir PER po akcijama — mora odgovarati computeRank kada ima akcija. */
export function sumPERFromAkcije(akcije: AkcijaZaRanking[]): number {
  return akcije.reduce((sum, a) => sum + computePERForAkcija(a), 0)
}
