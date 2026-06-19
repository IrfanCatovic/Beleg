import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { DefaultTheme, NavigationContainer } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import { AuthStack } from './stacks/AuthStack'
import { AppTabs } from './AppTabs'
import { colors } from '../theme'

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand,
    background: colors.bg,
    card: colors.navBgMid,
    text: colors.textOnDark,
    border: colors.navBorder,
  },
}

export function RootNavigator() {
  const { isLoggedIn, authLoading } = useAuth()

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    )
  }

  return (
    <NavigationContainer theme={navTheme}>
      {isLoggedIn ? <AppTabs /> : <AuthStack />}
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
})
