import type { AxiosInstance } from 'axios'

let apiInstance: AxiosInstance | null = null

export function setApiInstance(client: AxiosInstance): void {
  apiInstance = client
}

export function getApiInstance(): AxiosInstance {
  if (!apiInstance) {
    throw new Error('@beleg/shared: API client not initialized. Call setApiInstance first.')
  }
  return apiInstance
}
