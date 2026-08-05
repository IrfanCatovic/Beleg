import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { createApiClient } from './createApiClient'
import { createSessionGeneration } from '../auth/sessionGeneration'

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
  const sessionGen = createSessionGeneration()
  const bundle = createApiClient({
    baseURL: 'http://localhost:8080',
    storage,
    withCredentials: false,
    sessionGeneration: sessionGen,
  })
  return { bundle, onRejected, store, sessionGen }
}

function makeAxiosError(status: number, url: string, requestGeneration?: number, method = 'get'): AxiosError {
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

describe('createApiClient parallel 401 cleanup', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('5 concurrent 401s invoke handler once with session generation single-flight', async () => {
    const { bundle, onRejected, sessionGen } = captureParallel401Handler()
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    const gen = sessionGen.getSessionGeneration()
    const errors = [
      makeAxiosError(401, '/api/me', gen),
      makeAxiosError(401, '/api/klub', gen),
      makeAxiosError(401, '/api/obavestenja', gen),
      makeAxiosError(401, '/api/akcije', gen),
      makeAxiosError(401, '/api/korisnik/alice', gen),
    ]

    await Promise.all(
      errors.map((err) => onRejected(err).catch(() => undefined)),
    )

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('repeated handler invocation on new generations can cleanup again', async () => {
    const { bundle, onRejected, sessionGen } = captureParallel401Handler()
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    const gen1 = sessionGen.getSessionGeneration()
    await onRejected(makeAxiosError(401, '/api/me', gen1)).catch(() => undefined)
    expect(handler).toHaveBeenCalledTimes(1)

    sessionGen.advanceSessionGeneration()
    const gen2 = sessionGen.getSessionGeneration()
    await onRejected(makeAxiosError(401, '/api/me', gen2)).catch(() => undefined)
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('login POST 401 does not trigger global logout handler', async () => {
    const { bundle, onRejected, sessionGen } = captureParallel401Handler()
    const handler = vi.fn()
    bundle.setUnauthorizedHandler(handler)

    const gen = sessionGen.getSessionGeneration()
    await Promise.all([
      onRejected(makeAxiosError(401, '/api/me', gen)).catch(() => undefined),
      onRejected(makeAxiosError(401, '/login', gen, 'post')).catch(() => undefined),
      onRejected(makeAxiosError(401, '/api/klub', gen)).catch(() => undefined),
    ])

    expect(handler).toHaveBeenCalledTimes(1)
  })
})
