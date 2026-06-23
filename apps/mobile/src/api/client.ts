import { Platform } from 'react-native'
import { createApiClient, setApiInstance } from '@beleg/shared'
import { mobileStorage } from '../storage/mobileStorage'

const productionApi =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://planiner-api.onrender.com'

/** U browseru dev proxy (/api-proxy) zaobilazi CORS prema Renderu. */
const apiBaseURL =
  Platform.OS === 'web' && __DEV__ ? '/api-proxy' : productionApi

export const apiBundle = createApiClient({
  baseURL: apiBaseURL,
  storage: mobileStorage,
  withCredentials: false,
})

setApiInstance(apiBundle.client)

export const { client, setAuthToken, setUnauthorizedHandler } = apiBundle
