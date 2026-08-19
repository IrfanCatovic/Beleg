import { describe, expect, it } from 'vitest'
import {
  HOTEL_PRIVATE_DTO_KEYS,
  hotelPublicPath,
  hotelPublicVisibleSections,
  positiveHotelId,
} from './hotelPublic'

describe('hotel identity + route', () => {
  it('uses hotelId, not name', () => {
    expect(hotelPublicPath(42)).toBe('/hoteli/42')
    expect(positiveHotelId('42')).toBe(42)
    expect(positiveHotelId(0)).toBeNull()
    expect(positiveHotelId('Hotel Park')).toBeNull()
  })
})

describe('optional hotel sections', () => {
  it('hides empty sections', () => {
    const s = hotelPublicVisibleSections({
      opis: '  ',
      slike: [],
      telefon: '',
      bookingUrl: '',
      instagramUrl: undefined,
    })
    expect(s.opis).toBe(false)
    expect(s.gallery).toBe(false)
    expect(s.telefon).toBe(false)
    expect(s.booking).toBe(false)
    expect(s.instagram).toBe(false)
  })

  it('shows only present public fields', () => {
    const s = hotelPublicVisibleSections({
      opis: 'Planinarski dom',
      slike: ['https://cdn.example/a.jpg'],
      telefon: '+381',
      bookingUrl: 'https://www.booking.com/x',
      instagramUrl: '@dom',
      lat: 43.8,
      lng: 19.5,
    })
    expect(s).toEqual({
      opis: true,
      gallery: true,
      telefon: true,
      booking: true,
      instagram: true,
      map: true,
    })
  })

  it('private field names stay out of the public contract list', () => {
    expect(HOTEL_PRIVATE_DTO_KEYS).toContain('status')
    expect(HOTEL_PRIVATE_DTO_KEYS).toContain('createdAt')
  })
})
