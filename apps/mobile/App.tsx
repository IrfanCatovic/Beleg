import { ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import LoginScreen from './src/screens/LoginScreen'
import HomeScreen from './src/screens/HomeScreen'

function Root() {
  const { isLoggedIn, authLoading } = useAuth()

  if (authLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    )
  }

  return isLoggedIn ? <HomeScreen /> : <LoginScreen />
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
