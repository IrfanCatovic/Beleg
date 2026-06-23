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

export function navigateFromDeepLinkUrl(url: string): boolean {
  const parsed = parseActionDeepLink(url)
  if (!parsed) return false
  navigateToActionDetail(parsed.id, parsed.inviteToken)
  return true
}
