import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  cancelAuthenticatedUserQueries,
  clearAuthenticatedUserQueryState,
} from './clearAuthenticatedUserQueryState'

describe('clearAuthenticatedUserQueryState', () => {
  it('removes me / profile / stats / notifications / guide / prijave query data', async () => {
    const qc = new QueryClient()
    qc.setQueryData(['me'], { username: 'alice', fullName: 'Alice A' })
    qc.setQueryData(['korisnik', 'alice'], { avatar_url: 'https://a/avatar.jpg', ukupnoKm: 42 })
    qc.setQueryData(['moje-prijave'], [{ id: 1, userId: 1 }])
    qc.setQueryData(['obavestenja'], [{ id: 9, naslov: 'Za Alice' }])
    qc.setQueryData(['guide-profile', 'me'], { telefon: '061' })
    qc.setQueryData(['klub'], { id: 3, name: 'Alice Club' })
    qc.setQueryData(['steps-history'], [{ date: '2026-01-01', steps: 9000 }])

    await clearAuthenticatedUserQueryState(qc)

    expect(qc.getQueryData(['me'])).toBeUndefined()
    expect(qc.getQueryData(['korisnik', 'alice'])).toBeUndefined()
    expect(qc.getQueryData(['moje-prijave'])).toBeUndefined()
    expect(qc.getQueryData(['obavestenja'])).toBeUndefined()
    expect(qc.getQueryData(['guide-profile', 'me'])).toBeUndefined()
    expect(qc.getQueryData(['klub'])).toBeUndefined()
    expect(qc.getQueryData(['steps-history'])).toBeUndefined()
    expect(qc.getQueryCache().getAll()).toHaveLength(0)
  })

  it('clears mutation cache', async () => {
    const qc = new QueryClient()
    const mut = qc.getMutationCache().build(qc, {
      mutationKey: ['update-me'],
      mutationFn: async () => ({ ok: true }),
    })
    expect(qc.getMutationCache().getAll().length).toBeGreaterThan(0)
    void mut

    await clearAuthenticatedUserQueryState(qc)

    expect(qc.getMutationCache().getAll()).toHaveLength(0)
  })

  it('cancels in-flight queries so late resolve does not stick after clear', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const deferred: { resolve: (v: unknown) => void } = {
      resolve: () => undefined,
    }
    const fetchPromise = new Promise((resolve) => {
      deferred.resolve = resolve
    })

    const obs = qc.getQueryCache().build(qc, {
      queryKey: ['me'],
      queryFn: async () => fetchPromise,
    })
    const fetchResult = obs.fetch()

    await cancelAuthenticatedUserQueries(qc)
    await clearAuthenticatedUserQueryState(qc)

    deferred.resolve({ username: 'alice-late' })
    await fetchResult.catch(() => undefined)

    expect(qc.getQueryData(['me'])).toBeUndefined()
  })

  it('still clears when cancelQueries throws', async () => {
    const qc = new QueryClient()
    qc.setQueryData(['me'], { username: 'alice' })
    vi.spyOn(qc, 'cancelQueries').mockRejectedValueOnce(new Error('cancel failed'))

    await clearAuthenticatedUserQueryState(qc)

    expect(qc.getQueryData(['me'])).toBeUndefined()
  })
})
