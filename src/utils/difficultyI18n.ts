import type { TFunction } from 'i18next'

export type ActionDifficultyBadge = {
  bg: string
  text: string
  border?: string
  label: string
}

const MOUNTAIN_TEZINA_STYLE: Record<string, { bg: string; text: string }> = {
  lako: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  srednje: { bg: 'bg-amber-50', text: 'text-amber-700' },
  tesko: { bg: 'bg-rose-50', text: 'text-rose-700' },
  teško: { bg: 'bg-rose-50', text: 'text-rose-700' },
  alpinizam: { bg: 'bg-violet-50', text: 'text-violet-700' },
}

const MOUNTAIN_TEZINA_BORDER: Record<string, { bg: string; text: string; border: string }> = {
  lako: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  srednje: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  tesko: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  teško: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  alpinizam: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
}

/** Prikaz težine planinarske akcije (lako, srednje, tesko, alpinizam). */
export function tezinaLabel(raw: string | undefined, t: TFunction): string {
  if (!raw?.trim()) return t('shared:difficulty.unknown')
  const k = raw.toLowerCase()
  if (k === 'lako') return t('shared:difficulty.easy')
  if (k === 'srednje') return t('shared:difficulty.medium')
  if (k === 'tesko' || k === 'teško') return t('shared:difficulty.hard')
  if (k === 'alpinizam') return t('shared:difficulty.alpinism')
  return t('shared:difficulty.unknown')
}

/** Ocena via ferrate (A, B/C, D, …) — prikazuje se kao u katalogu. */
export function ferrataTezinaLabel(raw: string | undefined): string {
  return raw?.trim() || ''
}

function ferrataTezinaColors(raw: string | undefined): { bg: string; text: string; border: string } {
  const s = (raw || '').toUpperCase()
  if (s.includes('E')) return { bg: 'bg-zinc-100', text: 'text-zinc-900', border: 'border-zinc-300' }
  if (s.includes('D')) return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' }
  if (s.includes('C')) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
  if (s.includes('B')) return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' }
  if (s.includes('A')) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
  return { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' }
}

/** Bedž težine/ocene za kartice akcija (planina ili via ferrata). */
export function actionDifficultyBadge(
  raw: string | undefined,
  t: TFunction,
  tipAkcije?: 'planina' | 'via_ferrata',
  opts?: { withBorder?: boolean },
): ActionDifficultyBadge {
  if (tipAkcije === 'via_ferrata') {
    const label = ferrataTezinaLabel(raw) || t('shared:difficulty.unknown')
    const colors = ferrataTezinaColors(raw)
    return { ...colors, label }
  }

  const fallback: ActionDifficultyBadge = {
    bg: 'bg-gray-50',
    text: 'text-gray-500',
    border: opts?.withBorder ? 'border-gray-200' : undefined,
    label: tezinaLabel(raw, t),
  }
  if (!raw?.trim()) return fallback

  const k = raw.toLowerCase()
  if (opts?.withBorder) {
    const row = MOUNTAIN_TEZINA_BORDER[k]
    if (row) return { ...row, label: tezinaLabel(raw, t) }
    return fallback
  }

  const style = MOUNTAIN_TEZINA_STYLE[k]
  if (style) return { ...style, label: tezinaLabel(raw, t) }
  return fallback
}

export function prijavaStatusLabel(status: string, t: TFunction): string {
  switch (status) {
    case 'prijavljen':
      return t('shared:prijavaStatus.registered')
    case 'popeo se':
      return t('shared:prijavaStatus.climbed')
    case 'nije uspeo':
      return t('shared:prijavaStatus.failed')
    case 'otkazano':
      return t('shared:prijavaStatus.cancelled')
    default:
      return status
  }
}
