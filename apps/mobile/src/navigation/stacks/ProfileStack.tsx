import { createNativeStackNavigator } from '@react-navigation/native-stack'
import MyProfileScreen from '../../features/profile/MyProfileScreen'
import ProfileSettingsScreen from '../../features/profile/ProfileSettingsScreen'
import UserProfileScreen from '../../features/profile/UserProfileScreen'
import ClubScreen from '../../features/club/ClubScreen'
import FinanceScreen from '../../features/finance/FinanceScreen'
import TasksScreen from '../../features/tasks/TasksScreen'
import type { ProfileStackParamList } from '../types'

const Stack = createNativeStackNavigator<ProfileStackParamList>()

export function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="MyProfile" component={MyProfileScreen} options={{ title: 'Profil' }} />
      <Stack.Screen
        name="ProfileSettings"
        component={ProfileSettingsScreen}
        options={{ title: 'Podešavanja' }}
      />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Korisnik' }} />
      <Stack.Screen name="Club" component={ClubScreen} options={{ title: 'Moj klub' }} />
      <Stack.Screen name="Finance" component={FinanceScreen} options={{ title: 'Finansije' }} />
      <Stack.Screen name="Tasks" component={TasksScreen} options={{ title: 'Zadaci' }} />
    </Stack.Navigator>
  )
}
