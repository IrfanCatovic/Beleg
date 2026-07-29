import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { clearAuthenticatedUserQueryState } from '../lib/clearAuthenticatedUserQueryState'

/**
 * Account-switch security contract: after User A logout cleanup,
 * QueryClient must not retain A-specific private data before User B session.
 */
describe('account switch cache isolation', () => {
  it('User B session does not see User A profile/club/notifications after clear', async () => {
    const qc = new QueryClient()

    qc.setQueryData(['me'], { username: 'alice', fullName: 'Alice A' })
    qc.setQueryData(['korisnik', 'alice'], { avatar_url: 'https://a/avatar.jpg' })
    qc.setQueryData(['obavestenja'], [{ id: 1, naslov: 'Alice notif' }])
    qc.setQueryData(['klub'], { id: 7, naziv: 'Alice Club' })
    qc.setQueryData(['moje-prijave'], [{ id: 99 }])
    qc.setQueryData(['steps-history'], [{ date: '2026-01-01', steps: 5000 }])

    await clearAuthenticatedUserQueryState(qc)

    qc.setQueryData(['me'], { username: 'bob', fullName: 'Bob B' })
    qc.setQueryData(['korisnik', 'bob'], { avatar_url: 'https://b/avatar.jpg' })

    expect(qc.getQueryData(['korisnik', 'alice'])).toBeUndefined()
    expect(qc.getQueryData(['obavestenja'])).toBeUndefined()
    expect(qc.getQueryData(['klub'])).toBeUndefined()
    expect(qc.getQueryData(['moje-prijave'])).toBeUndefined()
    expect(qc.getQueryData(['steps-history'])).toBeUndefined()
    expect(qc.getQueryData(['me'])).toEqual({ username: 'bob', fullName: 'Bob B' })
  })
})
