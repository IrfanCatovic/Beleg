import { describe, expect, it } from 'vitest'
import { publicClubKeys } from './queryKeys'
import {
  positiveClubId,
  publicClubHasAboutSection,
  resolvePublicClubJoinCta,
} from './publicClubModel'

describe('publicClubKeys', () => {
  it('detail keys differ for A and B and stay off own-club cache', () => {
    expect(publicClubKeys.detail(1)).toEqual(['public-club', 'detail', 1])
    expect(publicClubKeys.detail(2)).toEqual(['public-club', 'detail', 2])
    expect(publicClubKeys.detail(1)).not.toEqual(publicClubKeys.detail(2))
    expect(publicClubKeys.detail(1)[0]).not.toBe('klub')
  })
})

describe('positiveClubId', () => {
  it('accepts positive ints and numeric strings', () => {
    expect(positiveClubId(42)).toBe(42)
    expect(positiveClubId('7')).toBe(7)
  })

  it('rejects invalid ids', () => {
    expect(positiveClubId(0)).toBeNull()
    expect(positiveClubId(-1)).toBeNull()
    expect(positiveClubId(1.5)).toBeNull()
    expect(positiveClubId('1.5')).toBeNull()
    expect(positiveClubId('abc')).toBeNull()
    expect(positiveClubId(undefined)).toBeNull()
  })
})

describe('resolvePublicClubJoinCta', () => {
  it('outsider without club → send', () => {
    expect(
      resolvePublicClubJoinCta({ clubId: 5, userClubId: null, hasPendingForClub: false }),
    ).toBe('send')
  })

  it('pending for this club → withdraw', () => {
    expect(
      resolvePublicClubJoinCta({ clubId: 5, userClubId: null, hasPendingForClub: true }),
    ).toBe('withdraw')
  })

  it('member of same club → none', () => {
    expect(
      resolvePublicClubJoinCta({ clubId: 5, userClubId: 5, hasPendingForClub: false }),
    ).toBe('none')
  })

  it('owner/admin same club (has klubId) → none', () => {
    expect(
      resolvePublicClubJoinCta({ clubId: 9, userClubId: 9, hasPendingForClub: true }),
    ).toBe('none')
  })

  it('member of other club → none (never mutate)', () => {
    expect(
      resolvePublicClubJoinCta({ clubId: 5, userClubId: 99, hasPendingForClub: false }),
    ).toBe('none')
  })
})

describe('publicClubHasAboutSection', () => {
  it('hides empty card when no web/date', () => {
    expect(publicClubHasAboutSection({ webSajt: '', datumOsnivanja: '' })).toBe(false)
    expect(publicClubHasAboutSection({ webSajt: '  ', datumOsnivanja: null })).toBe(false)
  })

  it('shows when web or date present', () => {
    expect(publicClubHasAboutSection({ webSajt: 'https://x', datumOsnivanja: '' })).toBe(true)
    expect(publicClubHasAboutSection({ webSajt: '', datumOsnivanja: '1.1.2000.' })).toBe(true)
  })
})
