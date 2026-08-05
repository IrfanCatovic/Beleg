import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { createApiClient } from './createApiClient'
import { AUTH_TOKEN_KEY } from './constants'

type ResponseRejectHandler = (error: AxiosError) => Promise<never>

function captureResponseRejectHandler(): {
  bundle: ReturnType<typeof createApiClient>
  onRejected: ResponseRejectHandler
  store: Map<string, string>
} {
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

  let onRejected: ResponseRejectHandler = async (error) => Promise.reject(error)
  const instance = {
    interceptors: {
      request: { use: vi.fn() },
      response: {
        use: vi.fn((_onFulfilled: unknown, rejected: ResponseRejectHandler) => {
          onRejected = rejected
        }),
      },
    },
    get: vi.fn(),
    post: vi.fn(),
  }

  vi.spyOn(axios, 'create').mockReturnValue(instance as never)
  const bundle = createApiClient({
    baseURL: 'http://localhost:8080',
    storage,
    withCredentials: false,
  })
  return { bundle, onRejected, store }
}

function makeAxiosError(status: number, url: string, method = 'get', errorMsg = ''): AxiosError {
  return {
    config: { url, method } as InternalAxiosRequestConfig,
    response: { status, data: { error: errorMsg } },
    isAxiosError: true,
    name: 'AxiosError',
    message: 'error',
    toJSON: () => ({}),
  } as AxiosError
}

describe('createApiClient unauthorized coordinator', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('401 on protected route triggers unauthorized handler', async () => {
    const { bundle, onRejected } = captureResponseRejectHandler()
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    await expect(onRejected(makeAxiosError(401, '/api/me'))).rejects.toBeTruthy()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('login POST 401 does not trigger global logout handler', async () => {
    const { bundle, onRejected } = captureResponseRejectHandler()
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    await expect(onRejected(makeAxiosError(401, '/login', 'post'))).rejects.toBeTruthy()
    expect(handler).not.toHaveBeenCalled()
  })

  it('logout POST 401 does not trigger global logout handler (recursion guard)', async () => {
    const { bundle, onRejected } = captureResponseRejectHandler()
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    await expect(onRejected(makeAxiosError(401, '/api/logout', 'post'))).rejects.toBeTruthy()
    expect(handler).not.toHaveBeenCalled()
  })

  it('403 club hold triggers unauthorized handler', async () => {
    const { bundle, onRejected } = captureResponseRejectHandler()
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    await expect(
      onRejected(makeAxiosError(403, '/api/klub', 'get', 'Klub je privremeno suspendovan (hold).')),
    ).rejects.toBeTruthy()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('403 without hold message does not logout', async () => {
    const { bundle, onRejected } = captureResponseRejectHandler()
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    await expect(onRejected(makeAxiosError(403, '/api/register', 'post', 'Nemate dozvolu'))).rejects.toBeTruthy()
    expect(handler).not.toHaveBeenCalled()
  })

  it('network error does not trigger unauthorized handler', async () => {
    const { bundle, onRejected } = captureResponseRejectHandler()
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    const err = { config: { url: '/api/me', method: 'get' }, response: undefined } as AxiosError
    await expect(onRejected(err)).rejects.toBeTruthy()
    expect(handler).not.toHaveBeenCalled()
  })

  it('500 does not trigger unauthorized handler', async () => {
    const { bundle, onRejected } = captureResponseRejectHandler()
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    await expect(onRejected(makeAxiosError(500, '/api/me'))).rejects.toBeTruthy()
    expect(handler).not.toHaveBeenCalled()
  })

  it('activity 401 is ignored by global handler', async () => {
    const { bundle, onRejected } = captureResponseRejectHandler()
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    await expect(onRejected(makeAxiosError(401, '/api/activities/sync', 'post'))).rejects.toBeTruthy()
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('createApiClient token persistence', () => {
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

    vi.spyOn(axios, 'create').mockReturnValue({
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    } as never)

    const { setAuthToken, getAuthToken } = createApiClient({
      baseURL: 'http://localhost:8080',
      storage,
      withCredentials: false,
    })

    await setAuthToken('test-jwt-token')
    expect(await getAuthToken()).toBe('test-jwt-token')
    expect(store.get(AUTH_TOKEN_KEY)).toBe('test-jwt-token')

    await setAuthToken(null)
    expect(await getAuthToken()).toBeNull()
  })
})
