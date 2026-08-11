import { describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import {
  completeGoogleOnboarding,
  linkGoogleAccount,
  startGoogleAuth,
  type GoogleStartAuthResponse,
} from './google'

function mockClient(data: unknown): AxiosInstance {
  return {
    post: vi.fn().mockResolvedValue({ data }),
  } as unknown as AxiosInstance
}

describe('startGoogleAuth', () => {
  it('posts idToken to social google start', async () => {
    const client = mockClient({
      status: 'onboarding_required',
      onboardingToken: 'tok',
      email: 'a@b.com',
      fullName: 'A B',
      avatarUrl: 'https://example.com/a.png',
      suggestedUsername: 'ab',
    })
    const res = await startGoogleAuth(client, 'id-token')
    expect(client.post).toHaveBeenCalledWith('/api/auth/social/google', { idToken: 'id-token' })
    expect(res.status).toBe('onboarding_required')
    if (res.status === 'onboarding_required') {
      expect(res.email).toBe('a@b.com')
      expect(res.suggestedUsername).toBe('ab')
    }
  })

  it('distinguishes authenticated vs link_required', async () => {
    const authed: GoogleStartAuthResponse = {
      status: 'authenticated',
      role: '',
      token: 'jwt',
      user: { username: 'alice', fullName: 'Alice' },
      profileIncomplete: false,
    }
    expect(authed.status).toBe('authenticated')
    const link: GoogleStartAuthResponse = {
      status: 'link_required',
      code: 'SOCIAL_ACCOUNT_LINK_REQUIRED',
      linkToken: 'lt',
    }
    expect(link.status).toBe('link_required')
    expect(link.code).toBe('SOCIAL_ACCOUNT_LINK_REQUIRED')
  })
})

describe('completeGoogleOnboarding', () => {
  it('posts canonical onboarding body', async () => {
    const client = mockClient({
      status: 'authenticated',
      role: '',
      token: 'jwt',
      user: { username: 'irfancatovic', fullName: 'Irfan' },
    })
    const res = await completeGoogleOnboarding(client, {
      onboardingToken: 'ob',
      username: 'IrfanCatovic',
      pol: 'M',
      datumRodjenja: '1999-01-15',
    })
    expect(client.post).toHaveBeenCalledWith('/api/auth/social/google/complete', {
      onboardingToken: 'ob',
      username: 'irfancatovic',
      pol: 'M',
      datumRodjenja: '1999-01-15',
    })
    expect(res.status).toBe('authenticated')
  })
})

describe('linkGoogleAccount', () => {
  it('posts linkToken to authenticated link route', async () => {
    const client = mockClient({ status: 'authenticated' })
    const res = await linkGoogleAccount(client, 'lt')
    expect(client.post).toHaveBeenCalledWith('/api/auth/social/google/link', { linkToken: 'lt' })
    expect(res.status).toBe('authenticated')
  })
})
