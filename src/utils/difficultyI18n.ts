import type { TFunction } from 'i18next'

/** Prikaz težine akcije (isti ključevi u bazi: lako, srednje, tesko/teško, alpinizam). */
export function tezinaLabel(raw: string | undefined, t: TFunction): string {
  if (!raw?.trim()) return t('shared:difficulty.unknown')
  const k = raw.toLowerCase()
  if (k === 'lako') return t('shared:difficulty.easy')
  if (k === 'srednje') return t('shared:difficulty.medium')
  if (k === 'tesko' || k === 'teško') return t('shared:difficulty.hard')
  if (k === 'alpinizam') return t('shared:difficulty.alpinism')
  return t('shared:difficulty.unknown')
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
