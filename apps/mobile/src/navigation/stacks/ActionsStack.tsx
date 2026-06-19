import { createNativeStackNavigator } from '@react-navigation/native-stack'
import ActionsScreen from '../../features/actions/ActionsScreen'
import ActionDetailScreen from '../../features/actions/ActionDetailScreen'
import UserProfileScreen from '../../features/profile/UserProfileScreen'
import type { ActionsStackParamList } from '../types'

const Stack = createNativeStackNavigator<ActionsStackParamList>()

export function ActionsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ActionsList" component={ActionsScreen} options={{ title: 'Akcije' }} />
      <Stack.Screen name="ActionDetail" component={ActionDetailScreen} options={{ title: 'Akcija' }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profil' }} />
    </Stack.Navigator>
  )
}
