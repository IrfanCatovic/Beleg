import { describe, expect, it } from 'vitest'
import { profileKeys } from './profileKeys'

/**
 * Module 2 mobile profile query key isolation contract.
 */

describe('profile query key isolation', () => {
  it('user A and B have distinct korisnik keys', () => {
    const keyA = profileKeys.detail('1')
    const keyB = profileKeys.detail('2')
    expect(keyA).not.toEqual(keyB)
  })

  it('follow/block roots are per userId', () => {
    expect(profileKeys.followRoot(1)).not.toEqual(profileKeys.followRoot(2))
    expect(profileKeys.blockRoot(1)).not.toEqual(profileKeys.blockRoot(2))
  })

  it('username and id are separate cache entries', () => {
    expect(profileKeys.detail('alice')).not.toEqual(profileKeys.detail('1'))
  })
})
