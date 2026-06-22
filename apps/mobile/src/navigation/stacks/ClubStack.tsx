import { createNativeStackNavigator } from '@react-navigation/native-stack'
import ClubScreen from '../../features/club/ClubScreen'
import SuperadminKluboviScreen from '../../features/superadmin/SuperadminKluboviScreen'
import ClubMembersScreen from '../../features/club/ClubMembersScreen'
import UserProfileScreen from '../../features/profile/UserProfileScreen'
import ActionDetailScreen from '../../features/actions/ActionDetailScreen'
import TasksScreen from '../../features/tasks/TasksScreen'
import FinanceScreen from '../../features/finance/FinanceScreen'
import { rootStackScreenOptions, stackScreenOptions } from '../screenOptions'
import type { ClubStackParamList } from '../types'

const Stack = createNativeStackNavigator<ClubStackParamList>()

export function ClubStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ClubHome" component={ClubScreen} options={rootStackScreenOptions} />
      <Stack.Screen
        name="SuperadminKlubovi"
        component={SuperadminKluboviScreen}
        options={{ title: 'Superadmin' }}
      />
      <Stack.Screen name="ClubMembers" component={ClubMembersScreen} options={{ title: 'Članovi' }} />
      <Stack.Screen name="Tasks" component={TasksScreen} options={{ title: 'Zadaci' }} />
      <Stack.Screen name="Finance" component={FinanceScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ActionDetail" component={ActionDetailScreen} options={{ title: 'Akcija' }} />
    </Stack.Navigator>
  )
}
