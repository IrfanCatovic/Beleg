import { createNativeStackNavigator } from '@react-navigation/native-stack'
import BecomeGuideScreen from '../../features/profile/BecomeGuideScreen'
import MyProfileScreen from '../../features/profile/MyProfileScreen'
import ProfileSettingsScreen from '../../features/profile/ProfileSettingsScreen'
import UserProfileScreen from '../../features/profile/UserProfileScreen'
import FinanceScreen from '../../features/finance/FinanceScreen'
import TasksScreen from '../../features/tasks/TasksScreen'
import ActionDetailScreen from '../../features/actions/ActionDetailScreen'
import ActionEditScreen from '../../features/actions/ActionEditScreen'
import { rootStackScreenOptions, stackScreenOptions } from '../screenOptions'
import type { ProfileStackParamList } from '../types'

const Stack = createNativeStackNavigator<ProfileStackParamList>()

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="MyProfile" component={MyProfileScreen} options={rootStackScreenOptions} />
      <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
      <Stack.Screen name="BecomeGuide" component={BecomeGuideScreen} options={{ title: 'Postani vodič' }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Finance" component={FinanceScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Tasks" component={TasksScreen} />
      <Stack.Screen name="ActionDetail" component={ActionDetailScreen} />
      <Stack.Screen name="ActionEdit" component={ActionEditScreen} options={rootStackScreenOptions} />
    </Stack.Navigator>
  )
}
