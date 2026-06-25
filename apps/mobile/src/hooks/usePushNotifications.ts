import { useEffect, useRef } from 'react'
import { AppState, Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { registerPushToken, unregisterPushToken } from '@beleg/shared/services'
import { client } from '../api/client'
import { navigateToNotificationDetail } from '../navigation/navigationRef'

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

async function getExpoPushToken(): Promise<string | null> {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  const projectId = extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) {
    if (__DEV__) console.warn('[push] missing EAS projectId — push token unavailable')
    return null
  }
  const result = await Notifications.getExpoPushTokenAsync({ projectId })
  return result.data
}

async function registerDevicePushToken(): Promise<string | null> {
  const allowed = await ensurePushPermissions()
  if (!allowed) return null
  const token = await getExpoPushToken()
  if (!token) return null
  await registerPushToken(client, {
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  })
  return token
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
      try {
        const token = await registerDevicePushToken()
        if (!token || cancelled) return
        tokenRef.current = token
      } catch (err) {
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
