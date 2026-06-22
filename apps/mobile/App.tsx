import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './src/context/AuthContext'
import { ModalProvider } from './src/context/ModalContext'
import { RootNavigator } from './src/navigation/RootNavigator'
import { queryClient } from './src/lib/queryClient'
import { useAppUpdates } from './src/hooks/useAppUpdates'
import './src/i18n'

export default function App() {
  useAppUpdates()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ModalProvider>
              <RootNavigator />
              <StatusBar style="auto" />
            </ModalProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
