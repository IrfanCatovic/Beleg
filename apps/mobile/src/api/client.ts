import { createApiClient, setApiInstance } from '@beleg/shared'
import { mobileStorage } from '../storage/mobileStorage'
import { sessionGeneration } from '../auth/sessionGeneration'

const apiBaseURL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://planiner-api.onrender.com'

/** Avoid infinite hang on cold start if the request never settles (Android APK). */
const STARTUP_REQUEST_TIMEOUT_MS = 25_000

export const apiBundle = createApiClient({
  baseURL: apiBaseURL,
  storage: mobileStorage,
  withCredentials: false,
  sessionGeneration,
})

apiBundle.client.defaults.timeout = STARTUP_REQUEST_TIMEOUT_MS

setApiInstance(apiBundle.client)

export const { client, setAuthToken, setUnauthorizedHandler, getAuthToken } = apiBundle

export { apiBaseURL, STARTUP_REQUEST_TIMEOUT_MS }
