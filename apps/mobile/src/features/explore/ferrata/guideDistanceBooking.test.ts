import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { annotateGuidesWithDistance, formatGuideDistancePart } from '@beleg/shared'

const here = dirname(fileURLToPath(import.meta.url))

describe('mobile guide distance booking parity', () => {
  it('catalog fake 0 is replaced with real far distance', () => {
    const [g] = annotateGuidesWithDistance(
      [{ id: 1, baseLat: 43.8563, baseLng: 18.4131, distanceKm: 0 }],
      44.7866,
      20.4489,
    )
    expect(g.distanceKm).toBeGreaterThan(100)
    expect(formatGuideDistancePart(g.distanceKm)).not.toBe('0 km')
  })

  it('booking screens annotate catalog and never coerce missing to 0', () => {
    const ferrata = readFileSync(join(here, 'FerrataGuideBookingModal.tsx'), 'utf8')
    const peak = readFileSync(join(here, '../PeakGuideBookingModal.tsx'), 'utf8')
    expect(ferrata).toContain('annotateGuidesWithDistance')
    expect(peak).toContain('annotateGuidesWithDistance')
    expect(ferrata).toContain('formatGuideDistancePart')
    expect(peak).toContain('formatGuideDistancePart')
    expect(ferrata).not.toMatch(/distanceKm\s*\|\|\s*0/)
    expect(peak).not.toMatch(/distanceKm\s*\|\|\s*0/)
  })
})
