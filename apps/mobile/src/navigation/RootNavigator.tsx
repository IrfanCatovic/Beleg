import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { DefaultTheme, NavigationContainer } from '@react-navigation/native'
import { Linking } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { AuthStack } from './stacks/AuthStack'
import { AppTabs } from './AppTabs'
import { navigationRef, navigateFromDeepLinkUrl } from './navigationRef'
import { savePendingDeepLink } from './pendingDeepLink'
import { usePendingNavigationConsume } from './usePendingNavigationConsume'
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
  const [navigationReady, setNavigationReady] = useState(false)
  const navigationReadyForConsume = isLoggedIn && navigationReady

  const { runConsume, lastSuccessfulPushDedupeKeyRef } = usePendingNavigationConsume(
    isLoggedIn,
    authLoading,
    navigationReadyForConsume,
  )
  usePushNotifications(isLoggedIn, authLoading, {
    lastSuccessfulPushDedupeKeyRef,
    onAuthSettled: runConsume,
  })

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return
      if (!isLoggedIn) {
        void savePendingDeepLink(url)
        return
      }
      navigateFromDeepLinkUrl(url)
    }

    void Linking.getInitialURL().then(handleUrl)
    const sub = Linking.addEventListener('url', (event: { url: string }) => handleUrl(event.url))
    return () => sub.remove()
  }, [isLoggedIn])

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    )
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={() => setNavigationReady(true)}
    >
      {isLoggedIn ? <AppTabs /> : <AuthStack />}
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
})
