import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { hotelPublicPath } from '@beleg/shared'
import { hotelDetailNavParams } from './hotelDetailNav'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

describe('mobile HotelDetail navigation', () => {
  it('card navigates with hotelId', () => {
    expect(hotelDetailNavParams(9)).toEqual({ hotelId: 9 })
    expect(hotelPublicPath(9)).toBe('/hoteli/9')
  })

  it('Explore and Home stacks register HotelDetail', () => {
    const explore = readFileSync(join(root, 'navigation/stacks/ExploreStack.tsx'), 'utf8')
    const home = readFileSync(join(root, 'navigation/stacks/HomeStack.tsx'), 'utf8')
    expect(explore).toContain('name="HotelDetail"')
    expect(home).toContain('name="HotelDetail"')
  })

  it('Ferrata hotel card wires Detaljnije to HotelDetail', () => {
    const ferrata = readFileSync(join(root, 'features/explore/FerrataDetailScreen.tsx'), 'utf8')
    const hotels = readFileSync(join(root, 'features/explore/ferrata/FerrataHotelsSection.tsx'), 'utf8')
    expect(ferrata).toContain("navigate('HotelDetail'")
    expect(hotels).toContain('Detaljnije')
  })

  it('invalid external URL is guarded', () => {
    const screen = readFileSync(join(root, 'features/explore/HotelDetailScreen.tsx'), 'utf8')
    expect(screen).toContain('safeHttpUrl')
    expect(screen).toContain('Hotel nije pronađen')
  })
})
