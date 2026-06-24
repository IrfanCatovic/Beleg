import type { AkcijaListItem } from '@beleg/shared'

export type ActionSourceFilter = 'all' | 'club' | 'guide'
export type VisibilityFilter = 'all' | 'klubske' | 'javne'
export type DurationFilter = 'all' | 'oneDay' | 'multiDay'
export type DifficultyFilter = 'all' | 'lako' | 'srednje' | 'tesko' | 'alpinizam'
export type MonthFilter = 'all' | number

export interface ActionsFilters {
  source: ActionSourceFilter
  visibility: VisibilityFilter
  month: MonthFilter
  duration: DurationFilter
  difficulty: DifficultyFilter
}

export const EMPTY_ACTIONS_FILTERS: ActionsFilters = {
  source: 'all',
  visibility: 'all',
  month: 'all',
  duration: 'all',
  difficulty: 'all',
}

export function countActiveFilters(f: ActionsFilters): number {
  let n = 0
  if (f.source !== 'all') n++
  if (f.visibility !== 'all') n++
  if (f.month !== 'all') n++
  if (f.duration !== 'all') n++
  if (f.difficulty !== 'all') n++
  return n
}

export function isClubListedAkcija(a: AkcijaListItem): boolean {
  return a.organizatorTip !== 'vodic' && a.uIstorijiKluba !== false
}

export function isPublicActiveAkcija(a: AkcijaListItem): boolean {
  return !!a.javna && !a.isCompleted
}

/** Aktivne akcije iz API odgovora koje treba prikazati u listi (klupske + javne vodičke). */
export function listableAktivneFromApi(aktivne: AkcijaListItem[]): AkcijaListItem[] {
  return aktivne.filter((a) => isClubListedAkcija(a) || isPublicActiveAkcija(a))
}

export function mergeAkcijeById(...lists: AkcijaListItem[][]): AkcijaListItem[] {
  const byId = new Map<number, AkcijaListItem>()
  for (const list of lists) {
    for (const a of list) byId.set(a.id, a)
  }
  return Array.from(byId.values())
}

export function matchesActionFilters(a: AkcijaListItem, filters: ActionsFilters): boolean {
  if (filters.source === 'club' && a.organizatorTip === 'vodic') return false
  if (filters.source === 'guide' && a.organizatorTip !== 'vodic') return false

  if (filters.visibility === 'klubske' && a.javna) return false
  if (filters.visibility === 'javne' && !a.javna) return false

  if (filters.month !== 'all') {
    if (!a.datum) return false
    const d = new Date(a.datum)
    if (Number.isNaN(d.getTime())) return false
    if (d.getMonth() + 1 !== filters.month) return false
  }

  if (filters.duration !== 'all') {
    const days = a.brojDana ?? 1
    if (filters.duration === 'oneDay' && days > 1) return false
    if (filters.duration === 'multiDay' && days <= 1) return false
  }

  if (filters.difficulty !== 'all') {
    const raw = (a.tezina ?? '').toLowerCase()
    const norm = raw.includes('alpin') ? 'alpinizam' : raw.includes('tešk') || raw.includes('tesk') ? 'tesko' : raw.includes('sred') ? 'srednje' : raw.includes('lak') ? 'lako' : raw
    if (norm !== filters.difficulty) return false
  }

  return true
}
