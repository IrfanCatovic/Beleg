import {
  createApiClient,
  setApiInstance,
  type StorageAdapter,
} from '@beleg/shared'

const webStorage: StorageAdapter = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => {
    localStorage.setItem(key, value)
  },
  removeItem: (key) => {
    localStorage.removeItem(key)
  },
}

const apiBaseURL = import.meta.env.VITE_API_URL || ''

const bundle = createApiClient({
  baseURL: apiBaseURL,
  storage: webStorage,
  withCredentials: true,
})

setApiInstance(bundle.client)

export const { setAuthToken, setUnauthorizedHandler } = bundle
export default bundle.client
