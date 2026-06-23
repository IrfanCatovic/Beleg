import { createNavigationContainerRef } from '@react-navigation/native'
import type { AppTabsParamList } from './types'
import { parseActionDeepLink } from './parseActionDeepLink'

export const navigationRef = createNavigationContainerRef<AppTabsParamList>()

export function navigateToNotificationDetail(id: number) {
  if (!navigationRef.isReady()) return
  navigationRef.navigate('HomeTab', {
    screen: 'NotificationDetail',
    params: { id },
  })
}

export function navigateToActionDetail(id: number, inviteToken?: string) {
  if (!navigationRef.isReady()) return
  navigationRef.navigate('ActionsTab', {
    screen: 'ActionDetail',
    params: { id, inviteToken },
  })
}

export function navigateToActionEdit(id: number) {
  if (!navigationRef.isReady()) return
  navigationRef.navigate('ActionsTab', {
    screen: 'ActionEdit',
    params: { id },
  })
}

export function navigateToBecomeGuide() {
  if (!navigationRef.isReady()) return
  navigationRef.navigate('ProfileTab', {
    screen: 'BecomeGuide',
  })
}

export function navigateToActionDetailFromExplore(id: number) {
  if (!navigationRef.isReady()) return
  navigationRef.navigate('ExploreTab', {
    screen: 'ActionDetail',
    params: { id },
  })
}

export function navigateFromDeepLinkUrl(url: string): boolean {
  const parsed = parseActionDeepLink(url)
  if (!parsed) return false
  navigateToActionDetail(parsed.id, parsed.inviteToken)
  return true
}
