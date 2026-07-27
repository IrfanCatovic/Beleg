import { createNavigationContainerRef } from '@react-navigation/native'
import type { AppTabsParamList } from './types'
import { parseActionDeepLink } from './parseActionDeepLink'
import type { PendingNotificationTarget } from '../features/notifications/pendingNotificationTarget'

export const navigationRef = createNavigationContainerRef<AppTabsParamList>()

export function navigateToNotificationDetail(id: number): boolean {
  if (!navigationRef.isReady()) return false
  navigationRef.navigate('HomeTab', {
    screen: 'NotificationDetail',
    params: { id },
  })
  return true
}

export function navigateToActionDetail(id: number, inviteToken?: string): boolean {
  if (!navigationRef.isReady()) return false
  navigationRef.navigate('ActionsTab', {
    screen: 'ActionDetail',
    params: { id, inviteToken },
  })
  return true
}

export function navigateToActionEdit(id: number): boolean {
  if (!navigationRef.isReady()) return false
  navigationRef.navigate('ActionsTab', {
    screen: 'ActionEdit',
    params: { id },
  })
  return true
}

export function navigateToBecomeGuide(): boolean {
  if (!navigationRef.isReady()) return false
  navigationRef.navigate('ProfileTab', {
    screen: 'BecomeGuide',
  })
  return true
}

export function navigateToActionDetailFromExplore(id: number): boolean {
  if (!navigationRef.isReady()) return false
  navigationRef.navigate('ExploreTab', {
    screen: 'ActionDetail',
    params: { id },
  })
  return true
}

export function navigateFromDeepLinkUrl(url: string): boolean {
  const parsed = parseActionDeepLink(url)
  if (!parsed) return false
  return navigateToActionDetail(parsed.id, parsed.inviteToken)
}

/** Navigate a pending push target. Returns false if navigator not ready. */
export function navigatePendingNotificationTarget(target: PendingNotificationTarget): boolean {
  if (target.kind === 'notification-detail') {
    return navigateToNotificationDetail(target.notificationId)
  }
  if (target.kind === 'action-detail') {
    return navigateToActionDetail(target.actionId, target.inviteToken)
  }
  return false
}
