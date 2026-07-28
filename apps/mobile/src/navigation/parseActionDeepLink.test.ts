import { describe, expect, it } from 'vitest'
import { parseActionDeepLink, parseClaimRewardQueryValue } from './parseActionDeepLink'

describe('parseClaimRewardQueryValue', () => {
  it('only accepts exact 1', () => {
    expect(parseClaimRewardQueryValue('1')).toBe(true)
    expect(parseClaimRewardQueryValue(' 1 ')).toBe(true)
    expect(parseClaimRewardQueryValue('0')).toBeUndefined()
    expect(parseClaimRewardQueryValue('false')).toBeUndefined()
    expect(parseClaimRewardQueryValue('true')).toBeUndefined()
    expect(parseClaimRewardQueryValue('yes')).toBeUndefined()
    expect(parseClaimRewardQueryValue('')).toBeUndefined()
    expect(parseClaimRewardQueryValue('2')).toBeUndefined()
    expect(parseClaimRewardQueryValue(null)).toBeUndefined()
  })
})

/** Regression: URL deep-link parsing must stay intact for invite/action/reward flows. */
describe('parseActionDeepLink (URL deep-link)', () => {
  it('/akcije/42 → { id: 42 }', () => {
    expect(parseActionDeepLink('/akcije/42')).toEqual({ id: 42 })
  })

  it('parses planiner scheme with invite token', () => {
    expect(parseActionDeepLink('planiner://akcije/12?inviteToken=abc')).toEqual({
      id: 12,
      inviteToken: 'abc',
    })
  })

  it('parses https www.planiner.com action url', () => {
    expect(parseActionDeepLink('https://www.planiner.com/akcije/99')).toEqual({
      id: 99,
    })
  })

  it('?claimReward=1 → claimReward true', () => {
    expect(parseActionDeepLink('planiner://akcije/42?claimReward=1')).toEqual({
      id: 42,
      claimReward: true,
    })
    expect(parseActionDeepLink('https://www.planiner.com/akcije/42?claimReward=1')).toEqual({
      id: 42,
      claimReward: true,
    })
  })

  it('invalid claimReward values omit the param (never false)', () => {
    expect(parseActionDeepLink('/akcije/42?claimReward=0')).toEqual({ id: 42 })
    expect(parseActionDeepLink('/akcije/42?claimReward=false')).toEqual({ id: 42 })
    expect(parseActionDeepLink('/akcije/42?claimReward=')).toEqual({ id: 42 })
    expect(parseActionDeepLink('/akcije/42?claimReward=true')).toEqual({ id: 42 })
    expect(parseActionDeepLink('/akcije/42?claimReward=yes')).toEqual({ id: 42 })
    expect(parseActionDeepLink('/akcije/42?claimReward=2')).toEqual({ id: 42 })
  })

  it('invite + claim in both query orders', () => {
    expect(parseActionDeepLink('/akcije/42?inviteToken=abc&claimReward=1')).toEqual({
      id: 42,
      inviteToken: 'abc',
      claimReward: true,
    })
    expect(parseActionDeepLink('/akcije/42?claimReward=1&inviteToken=abc')).toEqual({
      id: 42,
      inviteToken: 'abc',
      claimReward: true,
    })
  })

  it('ignores unknown query params', () => {
    expect(parseActionDeepLink('/akcije/42?foo=bar&claimReward=1&x=1')).toEqual({
      id: 42,
      claimReward: true,
    })
  })

  it('rejects invalid action ids', () => {
    expect(parseActionDeepLink('/akcije/0?claimReward=1')).toBeNull()
    expect(parseActionDeepLink('/akcije/-1?claimReward=1')).toBeNull()
    expect(parseActionDeepLink('/akcije/abc?claimReward=1')).toBeNull()
  })

  it('decodes percent-encoded invite token', () => {
    expect(parseActionDeepLink('/akcije/5?inviteToken=a%2Fb%3Dc')).toEqual({
      id: 5,
      inviteToken: 'a/b=c',
    })
  })

  it('plus in invite token follows URLSearchParams (+ → space)', () => {
    expect(parseActionDeepLink('/akcije/5?inviteToken=ab+cd')).toEqual({
      id: 5,
      inviteToken: 'ab cd',
    })
  })

  it('fragment does not affect parse', () => {
    expect(parseActionDeepLink('/akcije/42?claimReward=1#section')).toEqual({
      id: 42,
      claimReward: true,
    })
  })

  it('malformed percent encoding does not throw', () => {
    expect(() => parseActionDeepLink('/akcije/42?inviteToken=%E0%A4%A')).not.toThrow()
    // URL constructor may still parse path; invite token value may be odd but no crash
    const result = parseActionDeepLink('/akcije/42?inviteToken=%E0%A4%A')
    expect(result?.id).toBe(42)
  })

  it('rejects unsupported action routes', () => {
    expect(parseActionDeepLink('/akcija/42?claimReward=1')).toBeNull()
    expect(parseActionDeepLink('/actions/42?claimReward=1')).toBeNull()
    expect(parseActionDeepLink('/reward/42')).toBeNull()
    expect(parseActionDeepLink('https://www.planiner.com/korisnik/ana')).toBeNull()
    expect(parseActionDeepLink('planiner://klub')).toBeNull()
  })

  it('web HTTPS and custom scheme yield the same claim result', () => {
    expect(parseActionDeepLink('planiner://akcije/7?claimReward=1')).toEqual(
      parseActionDeepLink('https://www.planiner.com/akcije/7?claimReward=1'),
    )
  })

  it('duplicate claimReward uses URLSearchParams first value', () => {
    expect(parseActionDeepLink('/akcije/42?claimReward=1&claimReward=0')).toEqual({
      id: 42,
      claimReward: true,
    })
    expect(parseActionDeepLink('/akcije/42?claimReward=0&claimReward=1')).toEqual({
      id: 42,
    })
  })

  it('empty invite token is omitted', () => {
    expect(parseActionDeepLink('/akcije/42?inviteToken=&claimReward=1')).toEqual({
      id: 42,
      claimReward: true,
    })
  })
})
