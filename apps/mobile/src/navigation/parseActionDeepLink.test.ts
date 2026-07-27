import { describe, expect, it } from 'vitest'
import { parseActionDeepLink } from './parseActionDeepLink'

/** Regression: URL deep-link parsing must stay intact for invite/action flows. */
describe('parseActionDeepLink (URL deep-link regression)', () => {
  it('parses planiner scheme with invite token', () => {
    expect(parseActionDeepLink('planiner://akcije/12?inviteToken=abc')).toEqual({
      id: 12,
      inviteToken: 'abc',
    })
  })

  it('parses https www.planiner.com action url', () => {
    expect(parseActionDeepLink('https://www.planiner.com/akcije/99')).toEqual({
      id: 99,
      inviteToken: undefined,
    })
  })

  it('rejects non-action paths', () => {
    expect(parseActionDeepLink('https://www.planiner.com/korisnik/ana')).toBeNull()
    expect(parseActionDeepLink('planiner://klub')).toBeNull()
  })
})
