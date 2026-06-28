import type { UspesnaAkcija } from '@beleg/shared'

type TezinaKategorija = 'laka' | 'srednja' | 'teska' | 'alpinizam'

interface Tura {
  km: number
  uspon_m: number
  zimski: boolean
  tezinaKategorija: TezinaKategorija
  visinaVrha: number
  datum: string | Date
}

export interface ProfileRankResult {
  naziv: string
  boja: string
  per: number
}

const RANK_COLORS: Record<number, string> = {
  1: '#ccc4b1',
  2: '#556B2F',
  3: '#B7410E',
  4: '#8B0000',
  5: '#00CED1',
  6: '#000000',
}

const RANK_NAMES: Record<number, string> = {
  1: 'Početnik',
  2: 'Istraživač',
  3: 'Sedlar',
  4: 'Osvajač',
  5: 'Oblakolovac',
  6: 'Legenda stijena',
}

const SEGMENT_ROMAN = ['I', 'II', 'III', 'IV', 'V'] as const

function mapAkcijaToTura(a: UspesnaAkcija): Tura {
  if (a.tipAkcije === 'via_ferrata') {
    return { km: 0, uspon_m: 0, zimski: false, tezinaKategorija: 'laka', visinaVrha: 0, datum: a.datum }
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
    datum: a.datum,
  }
}

function perJedneTure(t: Tura): number {
  const TEZINA_BONUS: Record<TezinaKategorija, number> = {
    laka: 0,
    srednja: 0.05,
    teska: 0.1,
    alpinizam: 0.25,
  }
  const baza = t.km * 1 + t.uspon_m * 0.04
  const tezinaProcenat = TEZINA_BONUS[t.tezinaKategorija]
  let ukupniBonus = (t.zimski ? 0.15 : 0) + tezinaProcenat
  const visinaBonus =
    t.visinaVrha < 2000 ? 0.01 : t.visinaVrha < 2500 ? 0.02 : t.visinaVrha < 3000 ? 0.04 : t.visinaVrha < 3500 ? 0.06 : 0.1
  const kumulativniBonusRaw = Math.floor(t.uspon_m / 750) * 0.01
  const faktor = 1 + tezinaProcenat
  ukupniBonus += visinaBonus * faktor + kumulativniBonusRaw * faktor
  ukupniBonus += Math.floor(t.uspon_m / 500) * 0.02
  ukupniBonus = Math.min(ukupniBonus, 0.5)
  return Math.round(baza * (1 + ukupniBonus))
}

function getRankFromPER(per: number): ProfileRankResult {
  const perClamped = Math.max(0, Math.floor(per))
  if (perClamped >= 2500) {
    return { naziv: RANK_NAMES[6], boja: RANK_COLORS[6], per: perClamped }
  }
  const glavniRank = Math.min(6, Math.floor(perClamped / 500) + 1)
  if (glavniRank <= 0) {
    return { naziv: `${RANK_NAMES[1]} I`, boja: RANK_COLORS[1], per: perClamped }
  }
  const perURanku = perClamped - (glavniRank - 1) * 500
  const segment = Math.max(1, Math.min(5, Math.floor(perURanku / 100) + 1))
  const naziv = glavniRank <= 5 ? `${RANK_NAMES[glavniRank]} ${SEGMENT_ROMAN[segment - 1]}` : RANK_NAMES[6]
  return { naziv, boja: RANK_COLORS[glavniRank], per: perClamped }
}

export function computeProfileRank(
  akcije: UspesnaAkcija[],
  stats: { ukupnoKm?: number; ukupnoMetaraUspona?: number },
): ProfileRankResult {
  const ture = akcije.map(mapAkcijaToTura)
  const per =
    ture.length > 0
      ? ture.reduce((sum, t) => sum + perJedneTure(t), 0)
      : Math.round((stats.ukupnoKm ?? 0) * 1 + (stats.ukupnoMetaraUspona ?? 0) * 0.04)

  return getRankFromPER(per)
}

export function getRoleLabel(role?: string): string {
  const labels: Record<string, string> = {
    superadmin: 'Superadmin',
    admin: 'Admin',
    clan: 'Član',
    vodic: 'Vodič',
    blagajnik: 'Blagajnik',
    sekretar: 'Sekretar',
    'menadzer-opreme': 'Menadžer opreme',
  }
  return role ? labels[role] ?? role : ''
}

export function getRoleColor(role?: string): string {
  const colors: Record<string, string> = {
    superadmin: '#7e22ce',
    admin: '#dc2626',
    clan: '#2563eb',
    vodic: '#ea580c',
    blagajnik: '#059669',
    sekretar: '#eab308',
    'menadzer-opreme': '#475569',
  }
  return role ? colors[role] ?? '#64748b' : '#64748b'
}
