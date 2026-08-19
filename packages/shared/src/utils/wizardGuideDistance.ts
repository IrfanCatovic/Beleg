import type { WizardFerrataOption, WizardGuide, WizardValues } from '../types/actionWizard'
import {
  attachGuideDistanceKm,
  formatGuideDistancePart,
  isValidLatLng,
} from './geoDistance'

/** Empty wizard fields are missing origin — never coerce to 0,0. Explicit 0 is valid. */
export function parseWizardActionOrigin(
  latRaw?: string | number | null,
  lngRaw?: string | number | null,
): { lat: number; lng: number } | null {
  if (latRaw == null || lngRaw == null) return null
  if (typeof latRaw === 'string' && latRaw.trim() === '') return null
  if (typeof lngRaw === 'string' && lngRaw.trim() === '') return null
  const lat = typeof latRaw === 'number' ? latRaw : Number(String(latRaw).trim().replace(',', '.'))
  const lng = typeof lngRaw === 'number' ? lngRaw : Number(String(lngRaw).trim().replace(',', '.'))
  if (!isValidLatLng(lat, lng)) return null
  return { lat, lng }
}

export function resolveWizardActionOrigin(
  values: Pick<WizardValues, 'planinaLat' | 'planinaLng'>,
  selectedFerrata?: Pick<WizardFerrataOption, 'lat' | 'lng'> | null,
): { lat: number; lng: number } | null {
  const fromFields = parseWizardActionOrigin(values.planinaLat, values.planinaLng)
  if (fromFields) return fromFields
  if (selectedFerrata && isValidLatLng(selectedFerrata.lat, selectedFerrata.lng)) {
    return { lat: selectedFerrata.lat as number, lng: selectedFerrata.lng as number }
  }
  return null
}

export function withWizardGuideDistances(
  guides: WizardGuide[],
  origin: { lat: number; lng: number } | null,
): WizardGuide[] {
  return attachGuideDistanceKm(guides, origin?.lat, origin?.lng)
}

export function wizardGuideDistanceLabel(guide: Pick<WizardGuide, 'distanceKm'>): string {
  return formatGuideDistancePart(guide.distanceKm)
}

export function wizardGuideRowLabel(guide: WizardGuide): string {
  return `${guide.fullName} (@${guide.username}) · ${wizardGuideDistanceLabel(guide)}`
}

export function buildWizardGuidesFromCatalog(
  clubVodici: Array<{ id: number; username: string; fullName?: string }>,
  catalog: Array<{
    user?: { id: number; username: string; fullName?: string }
    baseLat?: number
    baseLng?: number
  }>,
): WizardGuide[] {
  const coordsByUserId = new Map<number, { lat: number; lng: number }>()
  for (const row of catalog) {
    const uid = row.user?.id
    if (!uid) continue
    if (isValidLatLng(row.baseLat, row.baseLng)) {
      coordsByUserId.set(uid, { lat: row.baseLat as number, lng: row.baseLng as number })
    }
  }

  const clubIds = new Set(clubVodici.map((v) => v.id))
  const guides: WizardGuide[] = clubVodici.map((v) => {
    const coords = coordsByUserId.get(v.id)
    return {
      id: v.id,
      username: v.username,
      fullName: (v.fullName || v.username).trim(),
      isProfiGuide: false,
      source: 'club' as const,
      baseLat: coords?.lat,
      baseLng: coords?.lng,
    }
  })

  for (const row of catalog) {
    const uid = row.user?.id
    if (!uid || clubIds.has(uid) || !row.user) continue
    const hasCoords = isValidLatLng(row.baseLat, row.baseLng)
    guides.push({
      id: uid,
      username: row.user.username,
      fullName: (row.user.fullName || row.user.username).trim(),
      isProfiGuide: true,
      source: 'profi',
      baseLat: hasCoords ? row.baseLat : undefined,
      baseLng: hasCoords ? row.baseLng : undefined,
    })
  }

  return guides
}
