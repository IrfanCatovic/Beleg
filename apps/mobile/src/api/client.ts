import { createApiClient, setApiInstance } from '@beleg/shared'
import { mobileStorage } from '../storage/mobileStorage'
import { sessionGeneration } from '../auth/sessionGeneration'

const apiBaseURL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://planiner-api.onrender.com'

export const apiBundle = createApiClient({
  baseURL: apiBaseURL,
  storage: mobileStorage,
  withCredentials: false,
  sessionGeneration,
})

setApiInstance(apiBundle.client)

export const { client, setAuthToken, setUnauthorizedHandler } = apiBundle
