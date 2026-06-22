import { createNavigationContainerRef } from '@react-navigation/native'
import type { AppTabsParamList } from './types'

export const navigationRef = createNavigationContainerRef<AppTabsParamList>()

export function navigateToNotificationDetail(id: number) {
  if (!navigationRef.isReady()) return
  navigationRef.navigate('HomeTab', {
    screen: 'NotificationDetail',
    params: { id },
  })
}
