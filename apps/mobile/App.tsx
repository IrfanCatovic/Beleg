import { useCallback, useEffect, useMemo, useState } from 'react'
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
import {
  AUTH_TOKEN_KEY,
  IS_LOGGED_IN_KEY,
  USER_STORAGE_KEY,
  createApiClient,
  fetchMe,
  meResponseToSessionUser,
  setApiInstance,
  type SessionUser,
} from '@beleg/shared'

const memoryStore = new Map<string, string>()

const mobileStorage = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memoryStore.set(key, value)
  },
  removeItem: (key: string) => {
    memoryStore.delete(key)
  },
}

async function loginRequest(
  client: ReturnType<typeof createApiClient>['client'],
  username: string,
  password: string,
) {
  const res = await client.post('/login', {
    username: username.trim(),
    password,
    remember_me: true,
  })
  return res.data as {
    token?: string
    role: string
    user: { username: string; fullName: string; avatar_url?: string; klubId?: number }
    profileIncomplete?: boolean
  }
}

export default function App() {
  const apiBundle = useMemo(
    () =>
      createApiClient({
        baseURL: process.env.EXPO_PUBLIC_API_URL ?? '',
        storage: mobileStorage,
        withCredentials: false,
      }),
    [],
  )

  useEffect(() => {
    setApiInstance(apiBundle.client)
  }, [apiBundle.client])

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await loginRequest(apiBundle.client, username, password)
      if (data.token) await apiBundle.setAuthToken(data.token)
      const session = meResponseToSessionUser({
        username: data.user.username,
        fullName: data.user.fullName,
        role: data.role,
        avatar_url: data.user.avatar_url,
        klubId: data.user.klubId,
      })
      setUser(session)
      mobileStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session))
      mobileStorage.setItem(IS_LOGGED_IN_KEY, 'true')
    } catch {
      setError('Login nije uspeo. Proverite EXPO_PUBLIC_API_URL i kredencijale.')
    } finally {
      setLoading(false)
    }
  }, [apiBundle, username, password])

  const handleFetchMe = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const me = await fetchMe(apiBundle.client)
      if (!me) {
        setUser(null)
        setError('Niste ulogovani (401).')
        return
      }
      const session = meResponseToSessionUser(me)
      setUser(session)
    } catch {
      setError('fetchMe nije uspeo.')
    } finally {
      setLoading(false)
    }
  }, [apiBundle.client])

  const handleLogout = useCallback(async () => {
    await apiBundle.setAuthToken(null)
    mobileStorage.removeItem(AUTH_TOKEN_KEY)
    mobileStorage.removeItem(USER_STORAGE_KEY)
    mobileStorage.removeItem(IS_LOGGED_IN_KEY)
    setUser(null)
  }, [apiBundle])

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Beleg Mobile (smoke test)</Text>
      <Text style={styles.subtitle}>@beleg/shared — login + fetchMe</Text>

      {!user ? (
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
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Ulogovan:</Text>
          <Text>{user.fullName} (@{user.username})</Text>
          <Text>Uloga: {user.role}</Text>
          <View style={styles.row}>
            <Button title="fetchMe" onPress={handleFetchMe} disabled={loading} />
            <Button title="Logout" onPress={handleLogout} />
          </View>
        </View>
      )}

      {loading && <ActivityIndicator style={styles.loader} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f8fafc' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  form: { gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  card: { gap: 8, padding: 16, backgroundColor: '#fff', borderRadius: 12 },
  label: { fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  loader: { marginTop: 16 },
  error: { color: '#dc2626', marginTop: 12 },
})
