import { createNativeStackNavigator } from '@react-navigation/native-stack'
import ExploreHomeScreen from '../../features/explore/ExploreHomeScreen'
import FerrataListScreen from '../../features/explore/FerrataListScreen'
import FerrataDetailScreen from '../../features/explore/FerrataDetailScreen'
import GuidesScreen from '../../features/explore/GuidesScreen'
import MapScreen from '../../features/explore/MapScreen'
import UserProfileScreen from '../../features/profile/UserProfileScreen'
import type { ExploreStackParamList } from '../types'

const Stack = createNativeStackNavigator<ExploreStackParamList>()

export function ExploreStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ExploreHome" component={ExploreHomeScreen} options={{ title: 'Istraži' }} />
      <Stack.Screen name="FerrataList" component={FerrataListScreen} options={{ title: 'Ferrate' }} />
      <Stack.Screen name="FerrataDetail" component={FerrataDetailScreen} options={{ title: 'Ferrata' }} />
      <Stack.Screen name="Guides" component={GuidesScreen} options={{ title: 'Vodiči' }} />
      <Stack.Screen name="Map" component={MapScreen} options={{ title: 'Mapa' }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profil' }} />
    </Stack.Navigator>
  )
}
