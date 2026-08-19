import { describe, expect, it } from 'vitest'
import { formatGuideDistancePart } from '@beleg/shared'

describe('web/mobile guide distance display parity', () => {
  it('real 0 km stays 0 km', () => {
    expect(formatGuideDistancePart(0)).toBe('0 km')
  })

  it('missing is unavailable, never 0 km', () => {
    expect(formatGuideDistancePart(undefined)).toBe('Udaljenost nije dostupna')
    expect(formatGuideDistancePart(null)).toBe('Udaljenost nije dostupna')
  })
})
