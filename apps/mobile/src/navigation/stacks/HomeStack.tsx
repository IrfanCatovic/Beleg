import { createNativeStackNavigator } from '@react-navigation/native-stack'
import HomeScreen from '../../features/home/HomeScreen'
import ActionDetailScreen from '../../features/actions/ActionDetailScreen'
import UserProfileScreen from '../../features/profile/UserProfileScreen'
import type { HomeStackParamList } from '../types'

const Stack = createNativeStackNavigator<HomeStackParamList>()

export function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Feed" component={HomeScreen} options={{ title: 'Početna' }} />
      <Stack.Screen name="ActionDetail" component={ActionDetailScreen} options={{ title: 'Akcija' }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profil' }} />
    </Stack.Navigator>
  )
}
