import { createApiClient } from './createApiClient'
import { describe, expect, it } from 'vitest'

describe('createApiClient', () => {
  it('persists auth token via storage adapter', async () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    }

    const { setAuthToken, getAuthToken } = createApiClient({
      baseURL: 'http://localhost:8080',
      storage,
      withCredentials: false,
    })

    await setAuthToken('test-jwt-token')
    expect(await getAuthToken()).toBe('test-jwt-token')

    await setAuthToken(null)
    expect(await getAuthToken()).toBeNull()
  })
})
