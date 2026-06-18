import type { AkcijaDetail, AkcijaFerrataSnapshot } from '../types/akcija'

export function ferrataActionName(akcija: Pick<AkcijaDetail, 'vrh' | 'ferrataSnapshot'>): string {
  return akcija.ferrataSnapshot?.naziv?.trim() || akcija.vrh?.trim() || ''
}

export function ferrataActionRegion(akcija: Pick<AkcijaDetail, 'ferrataSnapshot'>): string {
  return akcija.ferrataSnapshot?.lokacija?.trim() || ''
}

export function ferrataActionLocationSubtitle(akcija: Pick<AkcijaDetail, 'vrh' | 'ferrataSnapshot'>): string {
  const name = ferrataActionName(akcija)
  const region = ferrataActionRegion(akcija)
  return ['Via ferrata', name, region].filter(Boolean).join(' · ')
}

export function ferrataCatalogDurationLabel(snap?: AkcijaFerrataSnapshot | null): string | null {
  if (!snap) return null
  const min = snap.trajanje_min
  const max = snap.trajanje_max
  if (min != null && min > 0 && max != null && max > 0 && min !== max) return `${min}–${max} h`
  if (max != null && max > 0) return `${max} h`
  if (min != null && min > 0) return `${min} h`
  return null
}
