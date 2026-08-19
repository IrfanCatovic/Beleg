import { createNativeStackNavigator } from '@react-navigation/native-stack'
import HomeScreen from '../../features/home/HomeScreen'
import FerrataDetailScreen from '../../features/explore/FerrataDetailScreen'
import HotelDetailScreen from '../../features/explore/HotelDetailScreen'
import ActionDetailScreen from '../../features/actions/ActionDetailScreen'
import ActionEditScreen from '../../features/actions/ActionEditScreen'
import UserProfileScreen from '../../features/profile/UserProfileScreen'
import PublicClubScreen from '../../features/club/PublicClubScreen'
import PostDetailScreen from '../../features/home/PostDetailScreen'
import NotificationsScreen from '../../features/notifications/NotificationsScreen'
import NotificationDetailScreen from '../../features/notifications/NotificationDetailScreen'
import { rootStackScreenOptions, stackScreenOptions } from '../screenOptions'
import type { HomeStackParamList } from '../types'

const Stack = createNativeStackNavigator<HomeStackParamList>()

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Feed" component={HomeScreen} options={rootStackScreenOptions} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="ActionDetail" component={ActionDetailScreen} />
      <Stack.Screen name="ActionEdit" component={ActionEditScreen} options={rootStackScreenOptions} />
      <Stack.Screen name="FerrataDetail" component={FerrataDetailScreen} />
      <Stack.Screen name="HotelDetail" component={HotelDetailScreen} options={{ title: 'Hotel' }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PublicClub" component={PublicClubScreen} options={{ title: 'Klub' }} />
      <Stack.Screen name="NotificationsList" component={NotificationsScreen} />
      <Stack.Screen name="NotificationDetail" component={NotificationDetailScreen} />
    </Stack.Navigator>
  )
}
