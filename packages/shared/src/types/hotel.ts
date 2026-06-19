/** Hotel katalog — usklađeno sa backend/internal/models/hotel.go */

export interface HotelRow {
  id: number
  naziv: string
  lat?: number
  lng?: number
  coverImage?: string
  telefon?: string
  bookingUrl?: string
  instagramUrl?: string
  slike?: string[]
  [key: string]: unknown
}

export interface HotelNearbyPublic {
  id: number
  naziv: string
  lat?: number
  lng?: number
  distanceKm?: number
  coverImage?: string
  [key: string]: unknown
}
