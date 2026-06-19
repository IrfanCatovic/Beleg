import { createApiClient, setApiInstance } from '@beleg/shared'
import { mobileStorage } from '../storage/mobileStorage'

const apiBaseURL = process.env.EXPO_PUBLIC_API_URL ?? ''

export const apiBundle = createApiClient({
  baseURL: apiBaseURL,
  storage: mobileStorage,
  withCredentials: false,
})

setApiInstance(apiBundle.client)

export const { client, setAuthToken, setUnauthorizedHandler } = apiBundle
