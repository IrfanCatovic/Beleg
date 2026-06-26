import { useEffect, useRef } from 'react'
import { AppState, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { registerPushToken, unregisterPushToken } from '@beleg/shared/services'
import { client } from '../api/client'
import { navigateToNotificationDetail } from '../navigation/navigationRef'

// #region agent log
// Temporary push diagnostic surfaced on the Steps DEBUG card. Stores only a
// MASKED token prefix (no secret) so we can confirm token acquisition on the APK.
export const PUSH_DEBUG_KEY = 'pushDebug'
async function writePushDebug(obj: Record<string, unknown>): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PUSH_DEBUG_KEY,
      JSON.stringify({ ...obj, at: new Date().toLocaleTimeString('sr-RS') }),
    )
  } catch {
    // ignore
  }
}
// #endregion

const ANDROID_CHANNEL_ID = 'default'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

function parseObavestenjeId(data: Record<string, unknown> | undefined): number | null {
  const raw = data?.obavestenjeId
  if (typeof raw === 'number' && raw > 0) return raw
  if (typeof raw === 'string') {
    const id = parseInt(raw, 10)
    if (!Number.isNaN(id) && id > 0) return id
  }
  return null
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Obaveštenja',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1a6b52',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  })
}

/**
 * Expo's token endpoint can fail with transient 5xx ("SERVICE_UNAVAILABLE",
 * isTransient:true) under load. Retry with backoff so a momentary blip does not
 * leave the device without a registered push token.
 */
async function fetchExpoTokenWithRetry(
  projectId: string,
  maxAttempts = 5,
): Promise<{ token: string; attempts: number }> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await Notifications.getExpoPushTokenAsync({ projectId })
      return { token: result.data, attempts: attempt }
    } catch (err) {
      lastErr = err
      if (attempt < maxAttempts) {
        const delayMs = Math.min(15000, 2000 * 2 ** (attempt - 1))
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }
  throw lastErr
}

async function ensurePushPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false

  await ensureAndroidChannel()

  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  })
  return status === 'granted'
}

export function usePushNotifications(isLoggedIn: boolean) {
  const tokenRef = useRef<string | null>(null)

  useEffect(() => {
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = parseObavestenjeId(
        response.notification.request.content.data as Record<string, unknown> | undefined,
      )
      if (id != null) navigateToNotificationDetail(id)
    })

    return () => {
      responseSub.remove()
    }
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return
      const id = parseObavestenjeId(
        response.notification.request.content.data as Record<string, unknown> | undefined,
      )
      if (id != null) navigateToNotificationDetail(id)
    })
  }, [isLoggedIn])

  useEffect(() => {
    if (!isLoggedIn) {
      const token = tokenRef.current
      if (token) {
        void unregisterPushToken(client, token).catch(() => {})
        tokenRef.current = null
      }
      return
    }

    let cancelled = false

    async function register() {
      // #region agent log
      const dbg: Record<string, unknown> = {
        isDevice: Device.isDevice,
        perm: '?',
        projectId: false,
        token: 'none',
        registered: false,
        error: '',
      }
      // #endregion
      try {
        const permNow = await Notifications.getPermissionsAsync()
        dbg.perm = permNow.status
        const allowed = await ensurePushPermissions()
        if (!allowed) {
          dbg.perm = `${permNow.status}->denied`
          await writePushDebug(dbg)
          return
        }
        dbg.perm = 'granted'
        const extra = Constants.expoConfig?.extra as
          | { eas?: { projectId?: string } }
          | undefined
        const projectId = extra?.eas?.projectId ?? Constants.easConfig?.projectId
        dbg.projectId = !!projectId
        if (!projectId) {
          await writePushDebug(dbg)
          return
        }
        const { token, attempts } = await fetchExpoTokenWithRetry(projectId)
        dbg.attempts = attempts
        dbg.token = token.startsWith('ExponentPushToken[')
          ? 'ExponentPushToken[…]'
          : `other:${token.slice(0, 10)}…`
        await registerPushToken(client, {
          token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
        })
        dbg.registered = true
        await writePushDebug(dbg)
        if (cancelled) return
        tokenRef.current = token
      } catch (err) {
        // #region agent log
        dbg.error = err instanceof Error ? err.message : String(err)
        await writePushDebug(dbg)
        // #endregion
        if (__DEV__) console.warn('[push] register failed', err)
      }
    }

    void register()

    const tokenSub = Notifications.addPushTokenListener((event) => {
      const token = event.data
      if (!token || token === tokenRef.current) return
      tokenRef.current = token
      void registerPushToken(client, {
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      }).catch(() => {})
    })

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void register()
    })

    return () => {
      cancelled = true
      tokenSub.remove()
      appStateSub.remove()
    }
  }, [isLoggedIn])
}
