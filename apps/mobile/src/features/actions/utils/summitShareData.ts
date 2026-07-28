import { computePERForAkcija, type AkcijaDetail } from '@beleg/shared'

export type SummitAspect = '9:16' | '16:9'
export type SummitLayout = 'balanced' | 'stacked'

export const SUMMIT_ASPECT_SIZE: Record<SummitAspect, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
}

export type SummitMetricRow = {
  label: string
  value: string
}

export type SummitMountainShareData = {
  kind: 'mountain'
  brand: 'PLANINER'
  title: string
  metrics: SummitMetricRow[]
}

export type SummitFerrataBadgeVariant = 'universal' | 'djurdjevica'

export type SummitFerrataShareData = {
  kind: 'ferrata'
  brand: 'PLANINER'
  name: string
  dateLabel: string
  difficultyLabel: string
  badgeVariant: SummitFerrataBadgeVariant
}

export type SummitShareData = SummitMountainShareData | SummitFerrataShareData

function trimOrEmpty(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function formatTrailKm(km: number | undefined): string | null {
  if (km == null || Number.isNaN(Number(km))) return null
  const n = Number(km)
  if (n <= 0) return null
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
  return `${s} km`
}

function formatAscentM(m: number | undefined): string | null {
  if (m == null || Number.isNaN(Number(m))) return null
  const n = Math.round(Number(m))
  if (n <= 0) return null
  return `${n} m`
}

function formatDateLabel(datum: string | undefined): string | null {
  if (!datum?.trim()) return null
  try {
    const d = new Date(datum)
    if (Number.isNaN(d.getTime())) return datum.trim()
    return d.toLocaleDateString('sr-RS')
  } catch {
    return datum.trim()
  }
}

function isDjurdjevicaName(value: string): boolean {
  const n = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'dj')
  return n === 'djurdjevica' || n.includes('djurdjevica') || n.includes('durdevica')
}

export function resolveFerrataBadgeVariant(akcija: Pick<AkcijaDetail, 'naziv' | 'vrh' | 'ferrataSnapshot'>): SummitFerrataBadgeVariant {
  const candidates = [
    trimOrEmpty(akcija.ferrataSnapshot?.naziv),
    trimOrEmpty(akcija.vrh),
    trimOrEmpty(akcija.naziv),
  ].filter(Boolean)
  return candidates.some((name) => isDjurdjevicaName(name)) ? 'djurdjevica' : 'universal'
}

export function isFerrataSummitAction(akcija: Pick<AkcijaDetail, 'tipAkcije'>): boolean {
  return akcija.tipAkcije === 'via_ferrata'
}

/** Clamp display title to a bounded number of visual lines worth of characters. */
export function clampSummitTitle(raw: string, maxChars = 72): string {
  const t = raw.trim()
  if (!t) return '—'
  if (t.length <= maxChars) return t
  return `${t.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`
}

export function buildSummitShareData(akcija: AkcijaDetail): SummitShareData {
  if (isFerrataSummitAction(akcija)) {
    const name =
      trimOrEmpty(akcija.ferrataSnapshot?.naziv) ||
      trimOrEmpty(akcija.vrh) ||
      trimOrEmpty(akcija.naziv) ||
      '—'
    const difficulty =
      trimOrEmpty(akcija.ferrataSnapshot?.tezina) ||
      trimOrEmpty(akcija.tezina) ||
      '—'
    return {
      kind: 'ferrata',
      brand: 'PLANINER',
      name: clampSummitTitle(name, 48),
      dateLabel: formatDateLabel(akcija.datum) || '—',
      difficultyLabel: difficulty,
      badgeVariant: resolveFerrataBadgeVariant(akcija),
    }
  }

  const title =
    clampSummitTitle(
      trimOrEmpty(akcija.vrh) || trimOrEmpty(akcija.naziv) || '—',
      72,
    )
  const metrics: SummitMetricRow[] = []
  const planina = trimOrEmpty(akcija.planina)
  if (planina) metrics.push({ label: 'Planina', value: planina })
  const peak = trimOrEmpty(akcija.vrh)
  if (peak && peak !== title) metrics.push({ label: 'Vrh', value: peak })
  const trail = formatTrailKm(akcija.duzinaStazeKm)
  if (trail) metrics.push({ label: 'Dužina staze', value: trail })
  const ascent = formatAscentM(akcija.kumulativniUsponM)
  if (ascent) metrics.push({ label: 'Uspon', value: ascent })
  const date = formatDateLabel(akcija.datum)
  if (date) metrics.push({ label: 'Datum', value: date })

  const per = computePERForAkcija({
    tipAkcije: akcija.tipAkcije,
    duzinaStazeKm: akcija.duzinaStazeKm ?? 0,
    kumulativniUsponM: akcija.kumulativniUsponM ?? 0,
    visinaVrhM: akcija.visinaVrhM,
    zimskiUspon: akcija.zimskiUspon,
    tezina: akcija.tezina,
    datum: akcija.datum,
  })
  if (per > 0) metrics.push({ label: 'PER', value: `+${per} PER` })

  if (akcija.zimskiUspon && trimOrEmpty(akcija.tezina)) {
    metrics.push({ label: 'Težina', value: trimOrEmpty(akcija.tezina) })
  }

  return {
    kind: 'mountain',
    brand: 'PLANINER',
    title,
    metrics,
  }
}

/** Only true boolean is accepted; string "true" and other values are ignored. */
export function normalizeClaimRewardFlag(value: unknown): true | undefined {
  return value === true ? true : undefined
}
