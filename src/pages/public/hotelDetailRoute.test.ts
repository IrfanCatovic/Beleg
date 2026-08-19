import { describe, expect, it } from 'vitest'
import { hotelPublicPath, positiveHotelId } from '@beleg/shared'

describe('web hotel public route', () => {
  it('Detaljnije uses hotelId', () => {
    expect(hotelPublicPath(17)).toBe('/hoteli/17')
    expect(positiveHotelId('17')).toBe(17)
  })

  it('direct missing id is invalid', () => {
    expect(positiveHotelId('abc')).toBeNull()
  })
})
