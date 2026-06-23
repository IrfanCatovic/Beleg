import { createNativeStackNavigator } from '@react-navigation/native-stack'
import LoginScreen from '../../features/auth/LoginScreen'
import RegisterScreen from '../../features/auth/RegisterScreen'
import ForgotPasswordScreen from '../../features/auth/ForgotPasswordScreen'
import EnterClubInviteCodeScreen from '../../features/auth/EnterClubInviteCodeScreen'
import RegisterMemberScreen from '../../features/auth/RegisterMemberScreen'
import RegisterSuccessScreen from '../../features/auth/RegisterSuccessScreen'
import type { AuthStackParamList } from '../types'

const Stack = createNativeStackNavigator<AuthStackParamList>()

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="EnterClubInviteCode" component={EnterClubInviteCodeScreen} />
      <Stack.Screen name="RegisterMember" component={RegisterMemberScreen} />
      <Stack.Screen name="RegisterSuccess" component={RegisterSuccessScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  )
}
