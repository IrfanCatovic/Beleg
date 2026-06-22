import { createNativeStackNavigator } from '@react-navigation/native-stack'
import MyProfileScreen from '../../features/profile/MyProfileScreen'
import ProfileSettingsScreen from '../../features/profile/ProfileSettingsScreen'
import UserProfileScreen from '../../features/profile/UserProfileScreen'
import FinanceScreen from '../../features/finance/FinanceScreen'
import TasksScreen from '../../features/tasks/TasksScreen'
import ActionDetailScreen from '../../features/actions/ActionDetailScreen'
import { rootStackScreenOptions, stackScreenOptions } from '../screenOptions'
import type { ProfileStackParamList } from '../types'

const Stack = createNativeStackNavigator<ProfileStackParamList>()

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="MyProfile" component={MyProfileScreen} options={rootStackScreenOptions} />
      <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Finance" component={FinanceScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Tasks" component={TasksScreen} />
      <Stack.Screen name="ActionDetail" component={ActionDetailScreen} />
    </Stack.Navigator>
  )
}
