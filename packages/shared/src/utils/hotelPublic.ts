import { isValidLatLng } from './geoDistance'
import { normalizeInstagramUrl, safeHttpUrl } from './safeHttpUrl'

export function hotelPublicPath(hotelId: number): string {
  return `/hoteli/${hotelId}`
}

export function positiveHotelId(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

export type HotelPublicFields = {
  opis?: string | null
  slike?: string[] | null
  telefon?: string | null
  bookingUrl?: string | null
  instagramUrl?: string | null
  lat?: number | null
  lng?: number | null
}

export function hotelPublicVisibleSections(h: HotelPublicFields) {
  const gallery = (h.slike ?? []).map((s) => s.trim()).filter(Boolean)
  return {
    opis: Boolean(h.opis?.trim()),
    gallery: gallery.length > 0,
    telefon: Boolean(h.telefon?.trim()),
    booking: Boolean(safeHttpUrl(h.bookingUrl)),
    instagram: Boolean(normalizeInstagramUrl(h.instagramUrl)),
    map: isValidLatLng(h.lat, h.lng),
  }
}

export const HOTEL_PUBLIC_DTO_KEYS = [
  'id',
  'naziv',
  'slug',
  'lat',
  'lng',
  'opis',
  'telefon',
  'slike',
  'bookingUrl',
  'instagramUrl',
] as const

export const HOTEL_PRIVATE_DTO_KEYS = [
  'status',
  'createdAt',
  'updatedAt',
  'adminNapomena',
  'credentials',
  'billing',
] as const
