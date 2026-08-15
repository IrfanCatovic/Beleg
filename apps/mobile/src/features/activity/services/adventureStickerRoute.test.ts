import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePolyline, encodePolyline } from './activityMetrics'
import {
  ADVENTURE_STICKER_CAPTURE_OPTIONS,
  ADVENTURE_STICKER_SHARE_MIME,
  isAdventureStickerPngUri,
} from './adventureStickerCapture'
import { projectRouteToSvg } from './projectAdventureRoute'

const here = dirname(fileURLToPath(import.meta.url))

describe('Adventure sticker continuous route (source contracts)', () => {
  it('AdventureSticker no longer uses routeDots / View-per-point dots', async () => {
    const src = await readFile(join(here, '../components/AdventureSticker.tsx'), 'utf8')
    expect(src).not.toMatch(/routeDots/)
    expect(src).not.toMatch(/ROUTE_DOT/)
    expect(src).not.toMatch(/ROUTE_GAP/)
    expect(src).not.toMatch(/ROUTE_MAX_DOTS/)
    expect(src).not.toMatch(/routeDot/)
    expect(src).toContain('AdventureRouteSvg')
  })

  it('AdventureRouteSvg uses one continuous Path with round caps and fill none', async () => {
    const src = await readFile(join(here, '../components/AdventureRouteSvg.tsx'), 'utf8')
    expect(src).toContain('<Path')
    expect(src).toContain('fill="none"')
    expect(src).toContain('strokeLinecap="round"')
    expect(src).toContain('strokeLinejoin="round"')
    expect(src).not.toMatch(/routeDots/)
    expect(src).not.toMatch(/points\.map\(/)
    expect(src).not.toMatch(/<Circle/)
    expect(src).not.toMatch(/<Marker/)
    expect(src).not.toMatch(/backgroundColor:\s*['\"]?(#fff|white|#000|black)/i)
    expect(src).toContain("backgroundColor: 'transparent'")
  })

  it('AdventureRouteSvg has no background Rect', async () => {
    const src = await readFile(join(here, '../components/AdventureRouteSvg.tsx'), 'utf8')
    expect(src).not.toMatch(/<Rect/)
  })

  it('decoded final routePolyline is the sticker geometry source', () => {
    const original = [
      { lat: 44.0165, lng: 21.0059 },
      { lat: 44.0171, lng: 21.0072 },
      { lat: 44.0188, lng: 21.0061 },
    ]
    const decoded = decodePolyline(encodePolyline(original))
    const projected = projectRouteToSvg(decoded, 220, 118, 12)
    expect(projected.points).toHaveLength(3)
    expect(projected.pathD).toBeTruthy()
    // AdventureScreen decodes completedActivity.routePolyline → routePoints → sticker
    const screen = '' // documented by source test below
    void screen
  })

  it('AdventureScreen passes decoded routePolyline into sticker modal', async () => {
    const src = await readFile(join(here, '../screens/AdventureScreen.tsx'), 'utf8')
    expect(src).toContain('decodePolyline(completedActivity.routePolyline)')
    expect(src).toContain('routePoints={routePoints}')
    expect(src).toContain('<AdventureStickerModal')
  })

  it('capture format is PNG tmpfile; share mime is image/png', () => {
    expect(ADVENTURE_STICKER_CAPTURE_OPTIONS.format).toBe('png')
    expect(ADVENTURE_STICKER_CAPTURE_OPTIONS.result).toBe('tmpfile')
    expect(ADVENTURE_STICKER_SHARE_MIME).toBe('image/png')
  })

  it('modal capture uses ADVENTURE_STICKER_CAPTURE_OPTIONS (PNG)', async () => {
    const src = await readFile(join(here, '../components/AdventureStickerModal.tsx'), 'utf8')
    expect(src).toContain('ADVENTURE_STICKER_CAPTURE_OPTIONS')
    expect(src).toContain('ADVENTURE_STICKER_SHARE_MIME')
    expect(src).toContain('collapsable={false}')
    expect(src).toContain("backgroundColor: 'transparent'")
    expect(src).not.toMatch(/format:\s*['\"]jpg['\"]/)
  })

  it('Android/iOS share URI contract: non-empty tmpfile string is accepted', () => {
    expect(isAdventureStickerPngUri('file:///data/user/0/rs.planiner.app/cache/ReactNative/xxx.png')).toBe(
      true,
    )
    expect(isAdventureStickerPngUri('file:///var/mobile/Containers/Data/Application/.../tmp/xxx.png')).toBe(
      true,
    )
    expect(isAdventureStickerPngUri(null)).toBe(false)
    expect(isAdventureStickerPngUri('')).toBe(false)
  })

  it('web modal accepts routePoints for visual parity (export still mobile-only)', async () => {
    const src = await readFile(join(here, '../components/AdventureStickerModal.web.tsx'), 'utf8')
    expect(src).toContain('routePoints')
    expect(src).toContain('routePoints={routePoints}')
    expect(src).toContain('nije dostupno u browseru')
  })

  it('no dot interpolation helper remains in activity sticker flow', async () => {
    const sticker = await readFile(join(here, '../components/AdventureSticker.tsx'), 'utf8')
    const svg = await readFile(join(here, '../components/AdventureRouteSvg.tsx'), 'utf8')
    const combined = sticker + svg
    expect(combined).not.toMatch(/ROUTE_GAP/)
    expect(combined).not.toMatch(/interpolat/i)
    expect(combined).not.toMatch(/Math\.round\(dist \/ /)
  })
})

/**
 * Pixel alpha cannot be asserted here without a native PNG decoder dependency.
 * Device checklist (NOT executed in CI):
 * ANDROID: NIJE TESTIRANO RUČNO
 * IOS: NIJE TESTIRANO NA IOS UREĐAJU
 */
describe('alpha verification limits', () => {
  it('documents that real PNG alpha requires device verification', () => {
    expect(ADVENTURE_STICKER_CAPTURE_OPTIONS.format).toBe('png')
  })
})
