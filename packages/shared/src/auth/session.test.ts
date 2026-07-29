import { describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import {
  computeProfileIncomplete,
  fetchMe,
  logoutApi,
  meResponseToSessionUser,
  type MeResponse,
} from './session'

describe('computeProfileIncomplete', () => {
  it('returns false when all required profile fields present', () => {
    expect(
      computeProfileIncomplete({
        email: 'a@b.com',
        email_verified_at: '2026-01-01',
        pol: 'M',
        datum_rodjenja: '1990-01-01',
      }),
    ).toBe(false)
  })

  it('returns true when email missing or unverified', () => {
    expect(computeProfileIncomplete({ pol: 'M', datum_rodjenja: '1990-01-01' })).toBe(true)
    expect(
      computeProfileIncomplete({
        email: 'a@b.com',
        pol: 'M',
        datum_rodjenja: '1990-01-01',
      }),
    ).toBe(true)
  })
})

describe('meResponseToSessionUser', () => {
  it('maps API fields to session user without password', () => {
    const data: MeResponse = {
      username: 'alice',
      fullName: 'Alice A',
      role: 'clan',
      avatar_url: 'https://cdn/a.jpg',
      klubId: 3,
      email: 'alice@example.com',
      email_verified_at: '2026-01-01',
      pol: 'M',
      datum_rodjenja: '1990-01-01',
    }
    const session = meResponseToSessionUser(data)
    expect(session).toEqual({
      username: 'alice',
      fullName: 'Alice A',
      role: 'clan',
      avatarUrl: 'https://cdn/a.jpg',
      klubId: 3,
      profileIncomplete: false,
    })
    expect(session).not.toHaveProperty('password')
    expect(session).not.toHaveProperty('email')
  })
})

describe('fetchMe', () => {
  it('returns null on 401 without throwing', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ status: 401, data: null }),
    } as unknown as AxiosInstance
    const result = await fetchMe(client)
    expect(result).toBeNull()
    expect(client.get).toHaveBeenCalledWith('/api/me', {
      validateStatus: expect.any(Function),
    })
  })

  it('returns user data on 200', async () => {
    const payload: MeResponse = { username: 'alice', fullName: 'Alice', role: 'clan' }
    const client = {
      get: vi.fn().mockResolvedValue({ status: 200, data: payload }),
    } as unknown as AxiosInstance
    expect(await fetchMe(client)).toEqual(payload)
  })
})

describe('logoutApi', () => {
  it('swallows logout network errors', async () => {
    const client = {
      post: vi.fn().mockRejectedValue(new Error('offline')),
    } as unknown as AxiosInstance
    await expect(logoutApi(client)).resolves.toBeUndefined()
  })
})
