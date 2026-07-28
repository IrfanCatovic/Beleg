import { useEffect, useRef } from 'react'
import { AppState, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { registerPushToken, unregisterPushToken } from '@beleg/shared/services'
import { client } from '../api/client'
import { agentDebugLog } from '../lib/agentDebugLog'
import { queryClient } from '../lib/queryClient'
import {
  navigatePendingNotificationTarget,
  navigationRef,
} from '../navigation/navigationRef'
import { navigateMobileNotificationTarget } from '../navigation/navigateMobileNotificationTarget'
import { invalidateActionQueries } from '../features/actions/hooks/invalidateActionQueries'
import {
  parsePushNotificationData,
  resolveSemanticNotificationTarget,
  shouldInvalidateActionQueriesForPush,
} from '../features/notifications/resolveMobileNotificationNavigation'
import { decidePushNotificationResponse } from '../features/notifications/decidePushNotificationResponse'
import {
  applyPushNotificationDecision,
  consumePendingNotificationAfterAuth,
  shouldClearNativeLastNotificationResponse,
  type ApplyPushDecisionResult,
} from '../features/notifications/applyPushNotificationDecision'
import {
  clearPendingNotificationTarget,
  readPendingNotificationTarget,
  savePendingNotificationTarget,
  type PendingNotificationTarget,
} from '../features/notifications/pendingNotificationTarget'
import { resolvePushAppKind } from '../utils/resolveAppKind'

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

function tryNavigateTarget(
  target: PendingNotificationTarget,
  pushData?: Record<string, unknown>,
): boolean {
  if (pushData) {
    const semantic = resolveSemanticNotificationTarget({ pushData })
    const obavestenjeId =
      parsePushNotificationData(pushData).obavestenjeId ??
      (target.kind === 'notification-detail' ? target.notificationId : undefined)
    if (navigateMobileNotificationTarget(semantic, obavestenjeId ?? undefined)) {
      return true
    }
  }
  if (!navigationRef.isReady()) return false
  try {
    return navigatePendingNotificationTarget(target)
  } catch {
    return false
  }
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

export function usePushNotifications(isLoggedIn: boolean, authLoading = false) {
  const tokenRef = useRef<string | null>(null)
  /** Only set after a successful authenticated navigation — never on save-pending. */
  const lastSuccessfulNavKeyRef = useRef<string | null>(null)
  const isLoggedInRef = useRef(isLoggedIn)
  /** Cold-start getLastNotificationResponseAsync must complete safely once per JS session. */
  const coldStartHandledRef = useRef(false)

  useEffect(() => {
    isLoggedInRef.current = isLoggedIn
  }, [isLoggedIn])

  useEffect(() => {
    const applyDecision = (data: Record<string, unknown> | undefined) => {
      const decision = decidePushNotificationResponse({
        isLoggedIn: isLoggedInRef.current,
        pushData: data,
        lastSuccessfulDedupeKey: lastSuccessfulNavKeyRef.current,
      })

      if (decision.action === 'navigate' && decision.target.kind === 'action-detail') {
        void invalidateActionQueries(queryClient, decision.target.actionId).catch(() => {})
      }

      void applyPushNotificationDecision({
        decision,
        tryNavigate: (target) => tryNavigateTarget(target, data),
        savePending: savePendingNotificationTarget,
        clearPending: clearPendingNotificationTarget,
        onNavigated: (key) => {
          lastSuccessfulNavKeyRef.current = key
        },
      })
    }

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined
      applyDecision(data)
    })

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined
      const actionId = shouldInvalidateActionQueriesForPush(data)
      if (actionId != null) {
        void invalidateActionQueries(queryClient, actionId).catch(() => {})
      }
    })

    return () => {
      responseSub.remove()
      receivedSub.remove()
    }
  }, [])

  // After auth settles: cold-start response once (only after safe apply), then consume pending.
  useEffect(() => {
    if (authLoading) {
      return
    }
    if (!isLoggedIn) {
      lastSuccessfulNavKeyRef.current = null
    }

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let settleRetryWait: (() => void) | undefined

    const applyFromPushData = async (
      data: Record<string, unknown> | undefined,
    ): Promise<ApplyPushDecisionResult> => {
      const decision = decidePushNotificationResponse({
        isLoggedIn: isLoggedInRef.current,
        pushData: data,
        lastSuccessfulDedupeKey: lastSuccessfulNavKeyRef.current,
      })
      if (decision.action === 'navigate' && decision.target.kind === 'action-detail') {
        void invalidateActionQueries(queryClient, decision.target.actionId).catch(() => {})
      }
      return applyPushNotificationDecision({
        decision,
        tryNavigate: (target) => tryNavigateTarget(target, data),
        savePending: savePendingNotificationTarget,
        clearPending: clearPendingNotificationTarget,
        onNavigated: (key) => {
          lastSuccessfulNavKeyRef.current = key
        },
      })
    }

    const attemptConsume = async (): Promise<boolean> => {
      if (cancelled || !isLoggedInRef.current) return true
      const result = await consumePendingNotificationAfterAuth({
        readPending: readPendingNotificationTarget,
        clearPending: clearPendingNotificationTarget,
        tryNavigate: tryNavigateTarget,
        lastSuccessfulDedupeKey: lastSuccessfulNavKeyRef.current,
        onNavigated: (key) => {
          lastSuccessfulNavKeyRef.current = key
        },
        onBeforeNavigate: (target) => {
          if (target.kind === 'action-detail') {
            void invalidateActionQueries(queryClient, target.actionId).catch(() => {})
          }
        },
      })
      return result !== 'not-ready' && result !== 'navigate-failed'
    }

    void (async () => {
      if (!coldStartHandledRef.current) {
        const response = await Notifications.getLastNotificationResponseAsync()
        let applyResult: ApplyPushDecisionResult | null = null
        if (!cancelled && response) {
          const data = response.notification.request.content.data as
            | Record<string, unknown>
            | undefined
          applyResult = await applyFromPushData(data)
        }
        if (cancelled) return
        if (shouldClearNativeLastNotificationResponse(applyResult)) {
          coldStartHandledRef.current = true
          try {
            await Notifications.clearLastNotificationResponseAsync()
          } catch {
            // ignore — once-ref still prevents re-ingest after a safe apply
          }
        }
        // persist-failed: keep native last response + allow a later auth cycle to retry
      }

      if (cancelled || !isLoggedInRef.current) return

      const done = await attemptConsume()
      if (done || cancelled) return

      await new Promise<void>((resolve) => {
        settleRetryWait = resolve
        retryTimer = setTimeout(resolve, 400)
      })
      settleRetryWait = undefined
      retryTimer = undefined
      if (cancelled || !isLoggedInRef.current) return
      await attemptConsume()
    })()

    return () => {
      cancelled = true
      if (retryTimer != null) clearTimeout(retryTimer)
      settleRetryWait?.()
    }
  }, [isLoggedIn, authLoading])

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
        appOwnership: Constants.appOwnership,
        executionEnvironment: Constants.executionEnvironment,
        perm: '?',
        projectId: false,
        token: 'none',
        registered: false,
        error: '',
      }
      agentDebugLog(
        'usePushNotifications.ts:register:start',
        'push register started',
        {
          isDevice: Device.isDevice,
          appOwnership: Constants.appOwnership,
          executionEnvironment: Constants.executionEnvironment,
          isLoggedIn,
        },
        'E',
      )
      // #endregion
      try {
        const permNow = await Notifications.getPermissionsAsync()
        dbg.perm = permNow.status
        const allowed = await ensurePushPermissions()
        if (!allowed) {
          dbg.perm = `${permNow.status}->denied`
          await writePushDebug(dbg)
          // #region agent log
          agentDebugLog(
            'usePushNotifications.ts:register:perm',
            'push permission denied',
            { perm: dbg.perm },
            'B',
          )
          // #endregion
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
          // #region agent log
          agentDebugLog(
            'usePushNotifications.ts:register:projectId',
            'missing eas projectId',
            { hasExpoConfig: !!Constants.expoConfig },
            'C',
          )
          // #endregion
          return
        }
        const { token, attempts } = await fetchExpoTokenWithRetry(projectId)
        dbg.attempts = attempts
        dbg.token = token.startsWith('ExponentPushToken[')
          ? 'ExponentPushToken[…]'
          : `other:${token.slice(0, 10)}…`
        // #region agent log
        agentDebugLog(
          'usePushNotifications.ts:register:token',
          'expo push token acquired',
          {
            attempts,
            tokenPrefix: token.slice(0, 24),
            platform: Platform.OS,
          },
          'A',
        )
        // #endregion
        const appKind = resolvePushAppKind()
        dbg.appKind = appKind ?? ''
        const reg = await registerPushToken(client, {
          token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          appKind,
        })
        dbg.registered = true
        dbg.serverTokens = reg.tokens
        await writePushDebug(dbg)
        // #region agent log
        agentDebugLog(
          'usePushNotifications.ts:register:backend',
          'push token registered on backend',
          { platform: Platform.OS, registered: true },
          'E',
        )
        // #endregion
        if (cancelled) return
        tokenRef.current = token
      } catch (err) {
        // #region agent log
        dbg.error = err instanceof Error ? err.message : String(err)
        await writePushDebug(dbg)
        agentDebugLog(
          'usePushNotifications.ts:register:error',
          'push register failed',
          { error: dbg.error },
          'A',
        )
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
        appKind: resolvePushAppKind(),
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
