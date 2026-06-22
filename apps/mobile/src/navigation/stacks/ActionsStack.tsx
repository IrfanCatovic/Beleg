import { createNativeStackNavigator } from '@react-navigation/native-stack'
import ActionsScreen from '../../features/actions/ActionsScreen'
import ActionDetailScreen from '../../features/actions/ActionDetailScreen'
import ActionWizardScreen from '../../features/actions/ActionWizardScreen'
import AddPastActionScreen from '../../features/actions/AddPastActionScreen'
import UserProfileScreen from '../../features/profile/UserProfileScreen'
import { rootStackScreenOptions, stackScreenOptions } from '../screenOptions'
import type { ActionsStackParamList } from '../types'

const Stack = createNativeStackNavigator<ActionsStackParamList>()

export function ActionsStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ActionsList" component={ActionsScreen} options={rootStackScreenOptions} />
      <Stack.Screen name="ActionDetail" component={ActionDetailScreen} />
      <Stack.Screen name="ActionWizard" component={ActionWizardScreen} options={rootStackScreenOptions} />
      <Stack.Screen name="AddPastAction" component={AddPastActionScreen} options={rootStackScreenOptions} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  )
}
