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
    case 'action': {
      const params =
        target.claimReward === true
          ? { id: target.actionId, claimReward: true as const }
          : { id: target.actionId }
      return navigateTabScreen('ActionsTab', 'ActionDetail', params)
    }
    case 'profile': {
      const params =
        target.userId != null ? { id: target.userId } : { username: target.username! }
      return (
        navigateTabScreen('HomeTab', 'UserProfile', params) ||
        navigateTabScreen('ActionsTab', 'UserProfile', params) ||
        navigateTabScreen('ExploreTab', 'UserProfile', params) ||
        navigateTabScreen('ClubTab', 'UserProfile', params) ||
        navigateTabScreen('ProfileTab', 'UserProfile', params)
      )
    }
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
