/**
 * Planinarski MMR i rank sistem – računanje po turi sa bonusima i 6 glavnih rankova sa podnivoima.
 */

export type TezinaKategorija = 'laka' | 'srednja' | 'teska' | 'alpinizam'

export interface Tura {
  km: number
  uspon_m: number
  zimski: boolean
  tezinaKategorija: TezinaKategorija
  visinaVrha: number
  /** Datum ture (nije kažnjen starošću, služi za potencijalne buduće analize) */
  datum: string | Date
}

const BONUS_CAP = 0.5

const TEZINA_BONUS: Record<TezinaKategorija, number> = {
  laka: 0,
  srednja: 0.05,
  teska: 0.1,
  alpinizam: 0.25,
}

function getVisinaVrhaBonus(visinaVrha: number): number {
  if (visinaVrha < 2000) return 0
  if (visinaVrha < 2500) return 0.02
  if (visinaVrha < 3000) return 0.04
  if (visinaVrha < 3500) return 0.06
  return 0.08
}

/** Računa MMR za jednu turu. */
function mmrJedneTure(t: Tura): number {
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

  const mmr = Math.round(baza * (1 + ukupniBonus))
  return mmr
}

/** Ukupni MMR na osnovu niza tura. */
export function computeMMR(ture: Tura[]): number {
  return ture.reduce((sum, t) => sum + mmrJedneTure(t), 0)
}

/** Boje po glavnom ranku (1–6). */
export const RANK_COLORS: Record<number, string> = {
  1: '#ccc4b1',
  2: '#556B2F',
  3: '#B7410E',
  4: '#8B0000',
  5: '#00CED1',
  6: '#000000',
}

/** Imena glavnih rankova. */
export const RANK_NAMES: Record<number, string> = {
  1: 'Početnik',
  2: 'Istraživač',
  3: 'Sedlar',
  4: 'Osvajač',
  5: 'Oblakolovac',
  6: 'Legenda stijena',
}

const SEGMENT_ROMAN = ['I', 'II', 'III', 'IV', 'V'] as const
const MMR_PER_MAIN_RANK = 500
const MMR_PER_SEGMENT = 100

export interface RankResult {
  naziv: string
  boja: string
  mmr: number
  segment: number
  glavniRank: number
}

/**
 * Za dati ukupni MMR vraća glavni rank (1–6), segment (1–5 za rank 1–5; 0 za rank 6),
 * pun naziv (npr. "Početnik III") i boju.
 */
export function getRankFromMMR(mmr: number): RankResult {
  const mmrClamped = Math.max(0, Math.floor(mmr))

  if (mmrClamped >= 2500) {
    return {
      naziv: RANK_NAMES[6],
      boja: RANK_COLORS[6],
      mmr: mmrClamped,
      segment: 0,
      glavniRank: 6,
    }
  }

  const glavniRank = Math.min(6, Math.floor(mmrClamped / MMR_PER_MAIN_RANK) + 1)
  if (glavniRank <= 0) {
    return {
      naziv: `${RANK_NAMES[1]} I`,
      boja: RANK_COLORS[1],
      mmr: mmrClamped,
      segment: 1,
      glavniRank: 1,
    }
  }

  const mmrURanku = mmrClamped - (glavniRank - 1) * MMR_PER_MAIN_RANK
  const segment = Math.min(5, Math.floor(mmrURanku / MMR_PER_SEGMENT) + 1)
  const segmentClamped = Math.max(1, segment)
  const naziv =
    glavniRank <= 5
      ? `${RANK_NAMES[glavniRank]} ${SEGMENT_ROMAN[segmentClamped - 1]}`
      : RANK_NAMES[6]

  return {
    naziv,
    boja: RANK_COLORS[glavniRank],
    mmr: mmrClamped,
    segment: segmentClamped,
    glavniRank,
  }
}

/**
 * Računa rank iz objekta statistike koji sadrži niz tura.
 * Ako nema tura, može se proslediti ukupnoKm i ukupnoMetaraUspona za fallback (jedna "sintetička" tura bez bonusa).
 */
export function computeRank(statistika: {
  ture?: Tura[]
  ukupnoKm?: number
  ukupnoMetaraUspona?: number
}): RankResult {
  const ture = statistika.ture ?? []
  let mmr: number

  if (ture.length > 0) {
    mmr = computeMMR(ture)
  } else {
    const km = statistika.ukupnoKm ?? 0
    const uspon = statistika.ukupnoMetaraUspona ?? 0
    mmr = Math.round(km * 1 + uspon * 0.04)
  }

  return getRankFromMMR(mmr)
}

/** Objekat akcije kao iz API-ja (uspesneAkcije) – polja potrebna za MMR. */
export interface AkcijaZaRanking {
  duzinaStazeKm?: number
  kumulativniUsponM?: number
  visinaVrhM?: number
  zimskiUspon?: boolean
  tezina?: string
  datum: string
}

/** Mapira API akciju na Tura za MMR (tezina: lako→laka, srednje→srednja, teško→teska, alpinizam→alpinizam). */
export function mapAkcijaToTura(a: AkcijaZaRanking): Tura {
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
    datum: a.datum,
  }
}
