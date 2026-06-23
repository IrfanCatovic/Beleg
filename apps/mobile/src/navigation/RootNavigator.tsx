import { useEffect, useRef } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { DefaultTheme, NavigationContainer } from '@react-navigation/native'
import { Linking } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { AuthStack } from './stacks/AuthStack'
import { AppTabs } from './AppTabs'
import { navigationRef, navigateFromDeepLinkUrl } from './navigationRef'
import { consumePendingDeepLink, savePendingDeepLink } from './pendingDeepLink'
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
  usePushNotifications(isLoggedIn)
  const pendingConsumedRef = useRef(false)

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

  useEffect(() => {
    if (!isLoggedIn || authLoading) {
      pendingConsumedRef.current = false
      return
    }
    if (pendingConsumedRef.current) return
    pendingConsumedRef.current = true

    void (async () => {
      const pending = await consumePendingDeepLink()
      if (!pending) return
      const tryNavigate = () => {
        if (navigationRef.isReady()) {
          navigateFromDeepLinkUrl(pending)
          return true
        }
        return false
      }
      if (!tryNavigate()) {
        setTimeout(() => {
          tryNavigate()
        }, 400)
      }
    })()
  }, [isLoggedIn, authLoading])

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    )
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      {isLoggedIn ? <AppTabs /> : <AuthStack />}
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
})
