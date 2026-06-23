import AsyncStorage from '@react-native-async-storage/async-storage'
import { PENDING_DEEP_LINK_KEY, parseActionDeepLink } from './parseActionDeepLink'

export async function savePendingDeepLink(url: string): Promise<void> {
  const parsed = parseActionDeepLink(url)
  if (!parsed) return
  await AsyncStorage.setItem(PENDING_DEEP_LINK_KEY, url)
}

export async function consumePendingDeepLink(): Promise<string | null> {
  const url = await AsyncStorage.getItem(PENDING_DEEP_LINK_KEY)
  if (!url) return null
  await AsyncStorage.removeItem(PENDING_DEEP_LINK_KEY)
  return url
}

export async function peekPendingDeepLink(): Promise<string | null> {
  return AsyncStorage.getItem(PENDING_DEEP_LINK_KEY)
}
