import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { createApiClient } from './createApiClient'

type ResponseRejectHandler = (error: AxiosError) => Promise<never>

function captureParallel401Handler() {
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

function makeAxiosError(status: number, url: string): AxiosError {
  return {
    config: { url, method: 'get' } as InternalAxiosRequestConfig,
    response: { status, data: { error: 'unauthorized' } },
    isAxiosError: true,
    name: 'AxiosError',
    message: 'error',
    toJSON: () => ({}),
  } as AxiosError
}

describe('createApiClient parallel 401 cleanup', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('5 concurrent 401s invoke handler 5 times (idempotent, no coordinator)', async () => {
    const { bundle, onRejected } = captureParallel401Handler()
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    const errors = [
      makeAxiosError(401, '/api/me'),
      makeAxiosError(401, '/api/klub'),
      makeAxiosError(401, '/api/obavestenja'),
      makeAxiosError(401, '/api/akcije'),
      makeAxiosError(401, '/api/korisnik/alice'),
    ]

    await Promise.all(
      errors.map((err) => onRejected(err).catch(() => undefined)),
    )

    expect(handler).toHaveBeenCalledTimes(5)
  })

  it('repeated handler invocation does not throw (idempotent clearAuthState pattern)', async () => {
    const { bundle, onRejected } = captureParallel401Handler()
    const cleared: string[] = []
    const handler = vi.fn(() => {
      cleared.push('clear')
    })
    bundle.setUnauthorizedHandler(handler)

    const err = makeAxiosError(401, '/api/me')
    for (let i = 0; i < 3; i++) {
      await onRejected(err).catch(() => undefined)
    }
    expect(handler).toHaveBeenCalledTimes(3)
    expect(cleared).toEqual(['clear', 'clear', 'clear'])
  })

  it('login 401 during parallel protected 401s does not invoke global handler', async () => {
    const { bundle, onRejected } = captureParallel401Handler()
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    await Promise.all([
      onRejected(makeAxiosError(401, '/api/me')).catch(() => undefined),
      onRejected({
        ...makeAxiosError(401, '/login'),
        config: { url: '/login', method: 'post' } as InternalAxiosRequestConfig,
      }).catch(() => undefined),
      onRejected(makeAxiosError(401, '/api/klub')).catch(() => undefined),
    ])

    expect(handler).toHaveBeenCalledTimes(2)
  })
})
