import { describe, expect, it } from 'vitest'
import type { AkcijaDetail } from '@beleg/shared'
import {
  buildSummitShareData,
  clampSummitTitle,
  isFerrataSummitAction,
  normalizeClaimRewardFlag,
  resolveFerrataBadgeVariant,
} from './summitShareData'

function mountain(partial: Partial<AkcijaDetail> = {}): AkcijaDetail {
  return {
    id: 1,
    naziv: 'Uspon na Durmitor',
    vrh: 'Bobotov kuk',
    planina: 'Durmitor',
    datum: '2026-07-01',
    tipAkcije: 'planina',
    isCompleted: true,
    duzinaStazeKm: 12.5,
    kumulativniUsponM: 1100,
    ...partial,
  }
}

describe('summitShareData', () => {
  it('builds mountain metrics without empty fields', () => {
    const data = buildSummitShareData(mountain())
    expect(data.kind).toBe('mountain')
    if (data.kind !== 'mountain') return
    expect(data.brand).toBe('PLANINER')
    expect(data.title).toBe('Bobotov kuk')
    expect(data.metrics.some((m) => m.label === 'Planina')).toBe(true)
    expect(data.metrics.some((m) => m.label === 'Dužina staze')).toBe(true)
    expect(data.metrics.some((m) => m.label === 'Uspon')).toBe(true)
    expect(data.metrics.some((m) => m.label === 'PER')).toBe(true)
    expect(data.metrics.every((m) => m.value && m.value !== 'undefined')).toBe(true)
  })

  it('omits missing optional trail/ascent', () => {
    const data = buildSummitShareData(
      mountain({ duzinaStazeKm: undefined, kumulativniUsponM: undefined }),
    )
    if (data.kind !== 'mountain') return
    expect(data.metrics.some((m) => m.label === 'Dužina staze')).toBe(false)
    expect(data.metrics.some((m) => m.label === 'Uspon')).toBe(false)
  })

  it('clamps long title', () => {
    const long = 'A'.repeat(100)
    expect(clampSummitTitle(long).endsWith('…')).toBe(true)
    expect(clampSummitTitle(long).length).toBeLessThanOrEqual(72)
  })

  it('detects ferrata and djurdjevica badge', () => {
    const ferrata = mountain({
      tipAkcije: 'via_ferrata',
      naziv: 'Đurđevića Tara',
      vrh: 'Đurđevića',
      ferrataSnapshot: { naziv: 'Đurđevića Tara', tezina: 'C' },
    })
    expect(isFerrataSummitAction(ferrata)).toBe(true)
    expect(resolveFerrataBadgeVariant(ferrata)).toBe('djurdjevica')
    const data = buildSummitShareData(ferrata)
    expect(data.kind).toBe('ferrata')
    if (data.kind !== 'ferrata') return
    expect(data.badgeVariant).toBe('djurdjevica')
    expect(data.difficultyLabel).toBe('C')
  })

  it('generic ferrata badge fallback', () => {
    expect(
      resolveFerrataBadgeVariant({
        naziv: 'Obična ferata',
        vrh: 'Staza',
        ferrataSnapshot: { naziv: 'Staza A' },
      }),
    ).toBe('universal')
  })

  it('normalizeClaimRewardFlag only accepts boolean true', () => {
    expect(normalizeClaimRewardFlag(true)).toBe(true)
    expect(normalizeClaimRewardFlag(false)).toBeUndefined()
    expect(normalizeClaimRewardFlag('true')).toBeUndefined()
    expect(normalizeClaimRewardFlag(1)).toBeUndefined()
    expect(normalizeClaimRewardFlag(null)).toBeUndefined()
  })
})
