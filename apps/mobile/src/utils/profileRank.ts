import type { UspesnaAkcija } from '@beleg/shared'
import {
  computeRank,
  type RankResult,
} from '@beleg/shared/utils'

export type ProfileRankResult = Pick<RankResult, 'naziv' | 'boja' | 'per'>

export function computeProfileRank(
  akcije: UspesnaAkcija[],
  stats: { ukupnoKm?: number; ukupnoMetaraUspona?: number },
  vodeneAkcije: UspesnaAkcija[] = [],
): ProfileRankResult {
  const rank = computeRank({
    uspesneAkcije: akcije,
    vodeneAkcije,
    ukupnoKm: stats.ukupnoKm,
    ukupnoMetaraUspona: stats.ukupnoMetaraUspona,
  })
  return { naziv: rank.naziv, boja: rank.boja, per: rank.per }
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

export { getRankFromPER } from '@beleg/shared/utils'
