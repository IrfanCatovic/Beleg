import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { clearServerAuthCookieBestEffort } from './clearServerAuthCookie'

describe('clearServerAuthCookieBestEffort', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'Odjavljen' }), { status: 200 })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs to /api/logout without Authorization header', async () => {
    await clearServerAuthCookieBestEffort({ baseURL: 'http://localhost:8080', withCredentials: true })

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8080/api/logout')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    const headers = init.headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('uses relative URL when baseURL empty (dev proxy)', async () => {
    await clearServerAuthCookieBestEffort({ baseURL: '', withCredentials: true })
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    expect(url).toBe('/api/logout')
  })

  it('swallows network errors without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline')
    }))
    await expect(
      clearServerAuthCookieBestEffort({ baseURL: '', withCredentials: true }),
    ).resolves.toBeUndefined()
  })

  it('swallows 500 responses without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('error', { status: 500 })))
    await expect(
      clearServerAuthCookieBestEffort({ baseURL: '', withCredentials: true }),
    ).resolves.toBeUndefined()
  })
})
