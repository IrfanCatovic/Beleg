import { createNativeStackNavigator } from '@react-navigation/native-stack'
import ExploreHomeScreen from '../../features/explore/ExploreHomeScreen'
import FerrataListScreen from '../../features/explore/FerrataListScreen'
import FerrataDetailScreen from '../../features/explore/FerrataDetailScreen'
import GuidesScreen from '../../features/explore/GuidesScreen'
import MapScreen from '../../features/explore/MapScreen'
import UserProfileScreen from '../../features/profile/UserProfileScreen'
import { rootStackScreenOptions, stackScreenOptions } from '../screenOptions'
import type { ExploreStackParamList } from '../types'

const Stack = createNativeStackNavigator<ExploreStackParamList>()

export function ExploreStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ExploreHome" component={ExploreHomeScreen} options={rootStackScreenOptions} />
      <Stack.Screen name="FerrataList" component={FerrataListScreen} options={rootStackScreenOptions} />
      <Stack.Screen name="FerrataDetail" component={FerrataDetailScreen} />
      <Stack.Screen name="Guides" component={GuidesScreen} />
      <Stack.Screen name="Map" component={MapScreen} options={rootStackScreenOptions} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
    </Stack.Navigator>
  )
}
