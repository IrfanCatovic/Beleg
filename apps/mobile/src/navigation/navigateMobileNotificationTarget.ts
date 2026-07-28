import type { NotificationNavigationTarget } from '@beleg/shared'
import { navigationRef } from './navigationRef'

function navigateTabScreen(
  tab: 'HomeTab' | 'ActionsTab' | 'ExploreTab' | 'ClubTab' | 'ProfileTab',
  screen: string,
  params?: object,
): boolean {
  if (!navigationRef.isReady()) return false
  navigationRef.navigate(tab, { screen, params } as never)
  return true
}

/**
 * Navigate a canonical semantic notification target on mobile.
 * Unsupported destinations fall back to NotificationDetail when notificationId is known.
 */
export function navigateMobileNotificationTarget(
  target: NotificationNavigationTarget,
  notificationId?: number,
): boolean {
  switch (target.kind) {
    case 'action':
      if (!target.claimReward) {
        return navigateTabScreen('ActionsTab', 'ActionDetail', { id: target.actionId })
      }
      break
    case 'profile':
      return (
        navigateTabScreen('HomeTab', 'UserProfile', { username: target.username }) ||
        navigateTabScreen('ActionsTab', 'UserProfile', { username: target.username }) ||
        navigateTabScreen('ExploreTab', 'UserProfile', { username: target.username }) ||
        navigateTabScreen('ClubTab', 'UserProfile', { username: target.username }) ||
        navigateTabScreen('ProfileTab', 'UserProfile', { username: target.username })
      )
    case 'own-club':
      return navigateTabScreen('ClubTab', 'ClubHome')
    case 'guides':
      return navigateTabScreen('ExploreTab', 'Guides')
    case 'tasks':
      return (
        navigateTabScreen('ClubTab', 'Tasks') || navigateTabScreen('ProfileTab', 'Tasks')
      )
    case 'finances':
      return (
        navigateTabScreen('ClubTab', 'Finance') || navigateTabScreen('ProfileTab', 'Finance')
      )
    case 'home':
      return navigateTabScreen('HomeTab', 'Feed')
    case 'notification-detail':
      return navigateTabScreen('HomeTab', 'NotificationDetail', { id: target.notificationId })
    case 'club':
    case 'none':
      break
  }

  const detailId =
    notificationId != null && notificationId > 0 ? notificationId : null
  if (detailId != null) {
    return navigateTabScreen('HomeTab', 'NotificationDetail', { id: detailId })
  }
  return false
}
