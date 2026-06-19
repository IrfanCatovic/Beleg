import { createNativeStackNavigator } from '@react-navigation/native-stack'
import NotificationsScreen from '../../features/notifications/NotificationsScreen'
import NotificationDetailScreen from '../../features/notifications/NotificationDetailScreen'
import ActionDetailScreen from '../../features/actions/ActionDetailScreen'
import UserProfileScreen from '../../features/profile/UserProfileScreen'
import type { NotificationsStackParamList } from '../types'

const Stack = createNativeStackNavigator<NotificationsStackParamList>()

export function NotificationsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="NotificationsList"
        component={NotificationsScreen}
        options={{ title: 'Obaveštenja' }}
      />
      <Stack.Screen
        name="NotificationDetail"
        component={NotificationDetailScreen}
        options={{ title: 'Detalj' }}
      />
      <Stack.Screen name="ActionDetail" component={ActionDetailScreen} options={{ title: 'Akcija' }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profil' }} />
    </Stack.Navigator>
  )
}
