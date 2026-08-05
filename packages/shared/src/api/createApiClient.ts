import axios, { type AxiosInstance } from 'axios'
import {
  AUTH_TOKEN_KEY,
  SUPERADMIN_CLUB_ID_KEY,
  USER_STORAGE_KEY,
} from './constants'
import type { ApiClientBundle, ApiClientConfig } from './types'

type RequestConfigWithSession = {
  __sessionGeneration?: number
}

async function storageGet(
  storage: ApiClientConfig['storage'],
  key: string,
): Promise<string | null> {
  const value = storage.getItem(key)
  return value instanceof Promise ? value : value
}

async function storageSet(
  storage: ApiClientConfig['storage'],
  key: string,
  value: string,
): Promise<void> {
  const result = storage.setItem(key, value)
  if (result instanceof Promise) await result
}

async function storageRemove(
  storage: ApiClientConfig['storage'],
  key: string,
): Promise<void> {
  const result = storage.removeItem(key)
  if (result instanceof Promise) await result
}

export function createApiClient(config: ApiClientConfig): ApiClientBundle {
  const { storage, baseURL, withCredentials = false, sessionGeneration } = config

  const client: AxiosInstance = axios.create({
    baseURL,
    withCredentials,
    headers: { 'Content-Type': 'application/json' },
  })

  let onUnauthorized: (() => void) | null = null

  const setUnauthorizedHandler = (handler: (() => void) | null) => {
    onUnauthorized = handler
  }

  const setAuthToken = async (token: string | null) => {
    if (token) await storageSet(storage, AUTH_TOKEN_KEY, token)
    else await storageRemove(storage, AUTH_TOKEN_KEY)
  }

  const getAuthToken = () => storageGet(storage, AUTH_TOKEN_KEY)

  const shouldInvokeUnauthorizedHandler = (requestGeneration: number | undefined): boolean => {
    if (!sessionGeneration) return true
    if (requestGeneration === undefined) return false
    if (!sessionGeneration.isCurrentSessionGeneration(requestGeneration)) return false
    return sessionGeneration.tryBeginUnauthorizedCleanup(requestGeneration)
  }

  client.interceptors.request.use(async (reqConfig) => {
    if (sessionGeneration) {
      ;(reqConfig as RequestConfigWithSession).__sessionGeneration =
        sessionGeneration.getSessionGeneration()
    }
    const bearer = await storageGet(storage, AUTH_TOKEN_KEY)
    if (bearer) {
      reqConfig.headers.Authorization = `Bearer ${bearer}`
    }
    const savedUser = await storageGet(storage, USER_STORAGE_KEY)
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser) as { role?: string }
        const clubId = await storageGet(storage, SUPERADMIN_CLUB_ID_KEY)
        if (user.role === 'superadmin' && clubId) {
          reqConfig.headers['X-Club-Id'] = clubId
        }
      } catch {
        // ignore parse error
      }
    }
    if (reqConfig.data instanceof FormData) {
      // RN Android: axios mora poslati multipart bez Content-Type headera (boundary dodaje runtime).
      const headers = reqConfig.headers
      if (headers) {
        if (typeof headers.delete === 'function') {
          headers.delete('Content-Type')
          headers.delete('content-type')
        } else {
          delete (headers as Record<string, unknown>)['Content-Type']
          delete (headers as Record<string, unknown>)['content-type']
        }
      }
    }
    return reqConfig
  }, (error) => Promise.reject(error))

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const reqUrl = (error.config?.url || '').toString()
      const method = (error.config?.method || '').toLowerCase()
      const isLoginPost =
        method === 'post' && (reqUrl === '/login' || reqUrl.endsWith('/login'))
      const isLogoutPost =
        method === 'post' && (reqUrl === '/api/logout' || reqUrl.endsWith('/api/logout'))
      const isActivityRequest = reqUrl.includes('/api/activities')
      const requestGeneration = (error.config as RequestConfigWithSession | undefined)
        ?.__sessionGeneration
      if (
        error.response?.status === 401 &&
        onUnauthorized &&
        !isLoginPost &&
        !isLogoutPost &&
        !isActivityRequest
      ) {
        if (shouldInvokeUnauthorizedHandler(requestGeneration)) {
          onUnauthorized()
        }
      } else if (error.response?.status === 403 && onUnauthorized) {
        const msg = (error.response?.data as { error?: string })?.error ?? ''
        if (msg.includes('hold') || msg.includes('suspendovan')) {
          if (shouldInvokeUnauthorizedHandler(requestGeneration)) {
            onUnauthorized()
          }
        }
      }
      return Promise.reject(error)
    },
  )

  return { client, setAuthToken, setUnauthorizedHandler, getAuthToken }
}
