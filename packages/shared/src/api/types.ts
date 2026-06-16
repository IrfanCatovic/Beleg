import type { AxiosInstance } from 'axios'

export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}

export interface ApiClientConfig {
  baseURL: string
  storage: StorageAdapter
  withCredentials?: boolean
}

export interface ApiClientBundle {
  client: AxiosInstance
  setAuthToken: (token: string | null) => void | Promise<void>
  setUnauthorizedHandler: (handler: (() => void) | null) => void
  getAuthToken: () => string | null | Promise<string | null>
}
