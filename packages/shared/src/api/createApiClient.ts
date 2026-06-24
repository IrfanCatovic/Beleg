import axios, { type AxiosInstance } from 'axios'
import {
  AUTH_TOKEN_KEY,
  SUPERADMIN_CLUB_ID_KEY,
  USER_STORAGE_KEY,
} from './constants'
import type { ApiClientBundle, ApiClientConfig } from './types'

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
  const { storage, baseURL, withCredentials = false } = config

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

  client.interceptors.request.use(async (reqConfig) => {
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
      const isActivityRequest = reqUrl.includes('/api/activities')
      if (error.response?.status === 401 && onUnauthorized && !isLoginPost && !isActivityRequest) {
        onUnauthorized()
      } else if (error.response?.status === 403 && onUnauthorized) {
        const msg = (error.response?.data as { error?: string })?.error ?? ''
        if (msg.includes('hold') || msg.includes('suspendovan')) {
          onUnauthorized()
        }
      }
      return Promise.reject(error)
    },
  )

  return { client, setAuthToken, setUnauthorizedHandler, getAuthToken }
}
