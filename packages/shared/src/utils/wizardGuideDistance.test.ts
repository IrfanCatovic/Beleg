import { describe, expect, it } from 'vitest'
import { formatGuideDistancePart } from './geoDistance'
import {
  buildWizardGuidesFromCatalog,
  parseWizardActionOrigin,
  resolveWizardActionOrigin,
  wizardGuideRowLabel,
  withWizardGuideDistances,
} from './wizardGuideDistance'

const ACTION = { lat: 44.7866, lng: 20.4489 }
const NEAR = { lat: 44.7866, lng: 20.575 }
const FAR = { lat: 43.8563, lng: 18.4131 } // 100+ km
const VERY_FAR = { lat: 41.9981, lng: 21.4254 } // Skopje, 300+ km from Belgrade

describe('parseWizardActionOrigin', () => {
  it('empty wizard fields are unknown, not 0,0 fallback', () => {
    expect(parseWizardActionOrigin('', '')).toBeNull()
    expect(parseWizardActionOrigin(undefined, undefined)).toBeNull()
    expect(parseWizardActionOrigin(null, 20)).toBeNull()
  })

  it('explicit 0,0 strings/numbers are valid geographic origin', () => {
    expect(parseWizardActionOrigin('0', '0')).toEqual({ lat: 0, lng: 0 })
    expect(parseWizardActionOrigin(0, 0)).toEqual({ lat: 0, lng: 0 })
  })

  it('does not use truthy checks that drop real zero', () => {
    const origin = parseWizardActionOrigin(0, 1)
    expect(origin).toEqual({ lat: 0, lng: 1 })
  })
})

describe('withWizardGuideDistances', () => {
  const guides = [
    { id: 1, username: 'near', fullName: 'Near', baseLat: NEAR.lat, baseLng: NEAR.lng },
    { id: 2, username: 'far', fullName: 'Far', baseLat: FAR.lat, baseLng: FAR.lng },
    { id: 3, username: 'vfar', fullName: 'Very Far', baseLat: VERY_FAR.lat, baseLng: VERY_FAR.lng },
    { id: 4, username: 'nocoords', fullName: 'No Coords' },
  ]

  it('nearby guide gets a real distance, not 0', () => {
    const [near] = withWizardGuideDistances(guides, ACTION)
    expect(near.distanceKm).toBeGreaterThan(8)
    expect(near.distanceKm).toBeLessThan(12)
    expect(wizardGuideRowLabel(near)).toMatch(/\d+ km/)
    expect(wizardGuideRowLabel(near)).not.toMatch(/(^|[^0-9])0 km/)
  })

  it('100+ km and 300+ km stay real, never 0', () => {
    const out = withWizardGuideDistances(guides, ACTION)
    expect(out[1].distanceKm).toBeGreaterThan(100)
    expect(out[2].distanceKm).toBeGreaterThan(300)
    expect(formatGuideDistancePart(out[1].distanceKm)).not.toBe('0 km')
    expect(formatGuideDistancePart(out[2].distanceKm)).not.toBe('0 km')
  })

  it('missing guide coordinates → unavailable', () => {
    const out = withWizardGuideDistances(guides, ACTION)
    expect(out[3].distanceKm).toBeUndefined()
    expect(formatGuideDistancePart(out[3].distanceKm)).toBe('Udaljenost nije dostupna')
  })

  it('missing action coordinates → all unavailable', () => {
    const out = withWizardGuideDistances(guides, null)
    for (const g of out) {
      expect(g.distanceKm).toBeUndefined()
      expect(formatGuideDistancePart(g.distanceKm)).toBe('Udaljenost nije dostupna')
    }
  })

  it('changing action location recomputes distance', () => {
    const atA = withWizardGuideDistances(guides, ACTION)
    const atB = withWizardGuideDistances(guides, FAR)
    expect(atA[1].distanceKm).toBeGreaterThan(100)
    expect(atB[1].distanceKm).toBe(0)
    expect(atA[1].distanceKm).not.toBe(atB[1].distanceKm)
  })

  it('unknown distance is not 0', () => {
    const [g] = withWizardGuideDistances([{ id: 9, username: 'x', fullName: 'X' }], ACTION)
    expect(g.distanceKm).not.toBe(0)
    expect(g.distanceKm).toBeUndefined()
  })

  it('keeps club/profi input order (no distance sort)', () => {
    const clubFirst = [
      { id: 2, username: 'far', fullName: 'Far', source: 'club' as const, baseLat: FAR.lat, baseLng: FAR.lng },
      { id: 1, username: 'near', fullName: 'Near', source: 'profi' as const, baseLat: NEAR.lat, baseLng: NEAR.lng },
    ]
    const out = withWizardGuideDistances(clubFirst, ACTION)
    expect(out.map((g) => g.id)).toEqual([2, 1])
  })
})

describe('resolveWizardActionOrigin + ferrata fallback', () => {
  it('uses ferrata lat/lng when wizard fields are still empty', () => {
    const origin = resolveWizardActionOrigin(
      { planinaLat: '', planinaLng: '' },
      { lat: ACTION.lat, lng: ACTION.lng },
    )
    expect(origin).toEqual(ACTION)
  })

  it('empty ferrata coords do not become 0,0', () => {
    expect(resolveWizardActionOrigin({ planinaLat: '', planinaLng: '' }, { lat: undefined, lng: undefined })).toBeNull()
  })
})

describe('buildWizardGuidesFromCatalog', () => {
  it('copies catalog coords onto club guides and keeps far profi guides', () => {
    const out = buildWizardGuidesFromCatalog(
      [{ id: 1, username: 'club', fullName: 'Club' }],
      [
        { user: { id: 1, username: 'club', fullName: 'Club' }, baseLat: NEAR.lat, baseLng: NEAR.lng },
        { user: { id: 2, username: 'profi', fullName: 'Profi' }, baseLat: VERY_FAR.lat, baseLng: VERY_FAR.lng },
      ],
    )
    expect(out[0].baseLat).toBe(NEAR.lat)
    expect(out[1].source).toBe('profi')
    expect(out[1].baseLat).toBe(VERY_FAR.lat)
  })
})

describe('web/mobile parity helper', () => {
  it('same origin + guide yields the same label on both platforms', () => {
    const [g] = withWizardGuideDistances(
      [{ id: 1, username: 'g', fullName: 'G', baseLat: FAR.lat, baseLng: FAR.lng }],
      ACTION,
    )
    expect(wizardGuideRowLabel(g)).toBe(`G (@g) · ${formatGuideDistancePart(g.distanceKm)}`)
  })
})
