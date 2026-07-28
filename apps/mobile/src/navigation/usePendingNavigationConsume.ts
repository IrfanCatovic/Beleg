import { useCallback, useEffect, useRef } from 'react'
import { queryClient } from '../lib/queryClient'
import { invalidateActionQueries } from '../features/actions/hooks/invalidateActionQueries'
import {
  clearPendingNotificationTarget,
  readPendingNotificationTarget,
  type PendingNotificationTarget,
} from '../features/notifications/pendingNotificationTarget'
import {
  clearPendingDeepLink,
  readPendingDeepLink,
} from './pendingDeepLink'
import {
  consumePendingNavigation,
  resetPendingNavigationConsumeState,
} from './consumePendingNavigation'
import { navigateFromDeepLinkUrl, navigatePendingNotificationTarget, navigationRef } from './navigationRef'

export function usePendingNavigationConsume(
  isLoggedIn: boolean,
  authLoading: boolean,
  navigationReady: boolean,
) {
  const lastSuccessfulPushDedupeKeyRef = useRef<string | null>(null)
  const sessionConsumedRef = useRef(false)

  useEffect(() => {
    if (!isLoggedIn) {
      lastSuccessfulPushDedupeKeyRef.current = null
      sessionConsumedRef.current = false
      resetPendingNavigationConsumeState()
    }
  }, [isLoggedIn])

  const runConsume = useCallback(async () => {
    return consumePendingNavigation({
      isLoggedIn,
      authLoading,
      isNavigationReady: navigationReady && navigationRef.isReady(),
      sessionConsumed: sessionConsumedRef.current,
      readUrlPending: readPendingDeepLink,
      readPushPending: readPendingNotificationTarget,
      clearUrlPending: clearPendingDeepLink,
      clearPushPending: clearPendingNotificationTarget,
      tryNavigateUrl: (url) => navigateFromDeepLinkUrl(url),
      tryNavigatePush: (target) => navigatePendingNotificationTarget(target),
      lastSuccessfulPushDedupeKey: lastSuccessfulPushDedupeKeyRef.current,
      onPushNavigated: (key) => {
        lastSuccessfulPushDedupeKeyRef.current = key
      },
      onBeforePushNavigate: (target: PendingNotificationTarget) => {
        if (target.kind === 'action-detail') {
          void invalidateActionQueries(queryClient, target.actionId).catch(() => {})
        }
      },
      onSessionConsumed: () => {
        sessionConsumedRef.current = true
      },
    })
  }, [isLoggedIn, authLoading, navigationReady])

  useEffect(() => {
    if (authLoading || !isLoggedIn || !navigationReady) return
    void runConsume()
  }, [authLoading, isLoggedIn, navigationReady, runConsume])

  return {
    runConsume,
    lastSuccessfulPushDedupeKeyRef,
    sessionConsumedRef,
  }
}
