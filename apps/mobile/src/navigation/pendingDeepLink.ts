import AsyncStorage from '@react-native-async-storage/async-storage'
import { PENDING_DEEP_LINK_KEY, parseActionDeepLink } from './parseActionDeepLink'
import { normalizeSavedAt, type PendingDeepLinkRecord } from './pendingNavigationSelection'

function isValidUrl(url: string): boolean {
  return parseActionDeepLink(url) != null
}

function parseStoredDeepLink(raw: string): PendingDeepLinkRecord | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>
      if (typeof record.url === 'string') {
        const url = record.url.trim()
        if (!isValidUrl(url)) return null
        return { url, savedAt: normalizeSavedAt(record.savedAt) }
      }
    }
  } catch {
    // legacy plain URL string
  }

  if (!isValidUrl(trimmed)) return null
  return { url: trimmed, savedAt: 0 }
}

export async function savePendingDeepLink(url: string): Promise<void> {
  if (!isValidUrl(url)) return
  const record: PendingDeepLinkRecord = { url: url.trim(), savedAt: Date.now() }
  try {
    await AsyncStorage.setItem(PENDING_DEEP_LINK_KEY, JSON.stringify(record))
  } catch {
    // ignore
  }
}

export async function readPendingDeepLink(): Promise<PendingDeepLinkRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_DEEP_LINK_KEY)
    if (!raw) return null
    const parsed = parseStoredDeepLink(raw)
    if (!parsed) {
      await AsyncStorage.removeItem(PENDING_DEEP_LINK_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function clearPendingDeepLink(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_DEEP_LINK_KEY)
  } catch {
    // ignore
  }
}

/** @deprecated Prefer readPendingDeepLink — coordinator clears after successful navigation. */
export async function consumePendingDeepLink(): Promise<string | null> {
  const record = await readPendingDeepLink()
  if (!record) return null
  await clearPendingDeepLink()
  return record.url
}

export async function peekPendingDeepLink(): Promise<string | null> {
  const record = await readPendingDeepLink()
  return record?.url ?? null
}
