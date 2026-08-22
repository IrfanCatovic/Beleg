import { describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { fetchClubInviteCodeForAdmin } from './invite'

describe('fetchClubInviteCodeForAdmin', () => {
  it('maps backend "code" field to inviteCode', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        code: 'ABCD1234',
        regenAvailableInMs: 0,
        expiresAt: '2026-08-24T12:00:00Z',
      },
    })
    const client = { get } as unknown as ReturnType<typeof axios.create>

    const result = await fetchClubInviteCodeForAdmin(client)

    expect(get).toHaveBeenCalledWith('/api/klub/invite-code')
    expect(result.inviteCode).toBe('ABCD1234')
    expect(result.expiresAt).toBe('2026-08-24T12:00:00Z')
  })
})
