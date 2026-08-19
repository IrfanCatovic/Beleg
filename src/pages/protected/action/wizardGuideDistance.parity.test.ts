import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { wizardGuideRowLabel, withWizardGuideDistances } from '@beleg/shared'

const here = dirname(fileURLToPath(import.meta.url))

describe('web action wizard guide distance wiring', () => {
  it('annotates from wizard origin and shows km in dropdown labels', () => {
    const src = readFileSync(join(here, 'ActionWizardForm.tsx'), 'utf8')
    expect(src).toContain('withWizardGuideDistances')
    expect(src).toContain('resolveWizardActionOrigin')
    expect(src).toContain('wizardGuideRowLabel')
    expect(src).not.toMatch(/planinaLat\s*\|\|\s*0/)
    expect(src).not.toMatch(/distanceKm\s*\|\|\s*0/)
  })

  it('parity label for a far guide', () => {
    const [g] = withWizardGuideDistances(
      [{ id: 1, username: 'g', fullName: 'G', baseLat: 43.8563, baseLng: 18.4131 }],
      { lat: 44.7866, lng: 20.4489 },
    )
    expect(wizardGuideRowLabel(g)).not.toContain('0 km')
    expect(g.distanceKm).toBeGreaterThan(100)
  })
})
