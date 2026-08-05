import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { createApiClient } from './createApiClient'
import { createSessionGeneration } from '../auth/sessionGeneration'
import { AUTH_TOKEN_KEY } from './constants'

type ResponseRejectHandler = (error: AxiosError) => Promise<never>
type RequestFulfilledHandler = (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig

function captureClient(sessionGen = createSessionGeneration()) {
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
  let onRequest: RequestFulfilledHandler = (c) => c

  const instance = {
    interceptors: {
      request: {
        use: vi.fn((fulfilled: RequestFulfilledHandler) => {
          onRequest = fulfilled
        }),
      },
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
    sessionGeneration: sessionGen,
  })
  return { bundle, onRejected, onRequest, store, sessionGen }
}

function makeAxiosError(
  status: number,
  url: string,
  method = 'get',
  requestGeneration?: number,
): AxiosError {
  return {
    config: {
      url,
      method,
      __sessionGeneration: requestGeneration,
    } as InternalAxiosRequestConfig & { __sessionGeneration?: number },
    response: { status, data: { error: 'unauthorized' } },
    isAxiosError: true,
    name: 'AxiosError',
    message: 'error',
    toJSON: () => ({}),
  } as AxiosError
}

describe('createApiClient session generation guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('captures session generation on request', async () => {
    const { onRequest, sessionGen } = captureClient()
    const config = await onRequest({ headers: {} } as InternalAxiosRequestConfig)
    expect((config as { __sessionGeneration?: number }).__sessionGeneration).toBe(
      sessionGen.getSessionGeneration(),
    )
  })

  it('stale 401 does not invoke unauthorized handler', async () => {
    const sessionGen = createSessionGeneration()
    const { bundle, onRejected } = captureClient(sessionGen)
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    const staleGen = sessionGen.getSessionGeneration()
    sessionGen.advanceSessionGeneration()

    await onRejected(makeAxiosError(401, '/api/me', 'get', staleGen)).catch(() => undefined)
    expect(handler).not.toHaveBeenCalled()
  })

  it('current-generation 401 invokes handler', async () => {
    const sessionGen = createSessionGeneration()
    const { bundle, onRejected } = captureClient(sessionGen)
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    const gen = sessionGen.getSessionGeneration()
    await onRejected(makeAxiosError(401, '/api/me', 'get', gen)).catch(() => undefined)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('five parallel current-generation 401s invoke handler once (single-flight)', async () => {
    const sessionGen = createSessionGeneration()
    const { bundle, onRejected } = captureClient(sessionGen)
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    const gen = sessionGen.getSessionGeneration()
    const err = makeAxiosError(401, '/api/me', 'get', gen)
    await Promise.all(
      Array.from({ length: 5 }, () => onRejected(err).catch(() => undefined)),
    )
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('login POST 401 never invokes handler even with session generation', async () => {
    const sessionGen = createSessionGeneration()
    const { bundle, onRejected } = captureClient(sessionGen)
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    const gen = sessionGen.getSessionGeneration()
    await onRejected(makeAxiosError(401, '/login', 'post', gen)).catch(() => undefined)
    expect(handler).not.toHaveBeenCalled()
  })

  it('late 401 after login advance does not logout new session', async () => {
    const sessionGen = createSessionGeneration()
    const { bundle, onRejected } = captureClient(sessionGen)
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    const requestGen = sessionGen.getSessionGeneration()
    sessionGen.advanceSessionGeneration()

    await onRejected(makeAxiosError(401, '/api/klub', 'get', requestGen)).catch(() => undefined)
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('createApiClient session generation token persistence', () => {
  it('persists auth token via storage adapter with coordinator', async () => {
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
      sessionGeneration: createSessionGeneration(),
    })

    await setAuthToken('test-jwt-token')
    expect(await getAuthToken()).toBe('test-jwt-token')
    expect(store.get(AUTH_TOKEN_KEY)).toBe('test-jwt-token')
  })
})
