import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Button,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { loginApi, getApiErrorMessage } from '@beleg/shared'
import axios from 'axios'
import { client, setAuthToken } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function LoginScreen() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await loginApi(client, username, password)
      if (data.token) await setAuthToken(data.token)
      login(data)
    } catch (err) {
      if (axios.isAxiosError(err) && !err.response) {
        setError('Nema konekcije sa serverom. Proverite da li backend radi i EXPO_PUBLIC_API_URL.')
      } else if (axios.isAxiosError(err) && err.response?.status === 404) {
        setError(
          'Server nije pronađen (404). Port verovatno nije Beleg backend — proverite Apache/XAMPP na :8080.',
        )
      } else {
        setError(getApiErrorMessage(err, 'Login nije uspeo.'))
      }
    } finally {
      setLoading(false)
    }
  }, [username, password, login])

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Beleg</Text>
      <Text style={styles.subtitle}>Prijavite se na nalog</Text>
      {__DEV__ && process.env.EXPO_PUBLIC_API_URL ? (
        <Text style={styles.apiUrl}>API: {process.env.EXPO_PUBLIC_API_URL}</Text>
      ) : null}

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Username"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Button title="Login" onPress={handleLogin} disabled={loading} />
      </View>

      {loading && <ActivityIndicator style={styles.loader} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f8fafc' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  apiUrl: { fontSize: 12, color: '#94a3b8', marginBottom: 12 },
  form: { gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  loader: { marginTop: 16 },
  error: { color: '#dc2626', marginTop: 12 },
})
