import { createNativeStackNavigator } from '@react-navigation/native-stack'
import ClubScreen from '../../features/club/ClubScreen'
import { rootStackScreenOptions, stackScreenOptions } from '../screenOptions'
import type { ClubStackParamList } from '../types'

const Stack = createNativeStackNavigator<ClubStackParamList>()

export function ClubStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ClubHome" component={ClubScreen} options={rootStackScreenOptions} />
    </Stack.Navigator>
  )
}
