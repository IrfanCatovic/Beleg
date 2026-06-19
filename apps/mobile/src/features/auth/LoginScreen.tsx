import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import axios from 'axios'
import { loginApi, getApiErrorMessage } from '@beleg/shared'
import { client, setAuthToken } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Button, Input, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { AuthStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>

export default function LoginScreen({ navigation }: Props) {
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
        setError('Server nije pronađen (404). Proverite da port pokazuje na Beleg backend.')
      } else {
        setError(getApiErrorMessage(err, 'Login nije uspeo.'))
      }
    } finally {
      setLoading(false)
    }
  }, [username, password, login])

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text variant="title" color={colors.brand}>Beleg</Text>
        <Text variant="muted">Prijavite se na nalog</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Korisničko ime"
          placeholder="korisnicko_ime"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />
        <Input
          label="Lozinka"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text variant="small" color={colors.danger}>{error}</Text> : null}
        <Button title="Prijava" loading={loading} onPress={handleLogin} fullWidth />
        <Button
          title="Zaboravljena lozinka?"
          variant="ghost"
          onPress={() => navigation.navigate('ForgotPassword')}
        />
        <Button
          title="Nemate nalog? Registrujte se"
          variant="ghost"
          onPress={() => navigation.navigate('Register')}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl, gap: spacing.xs },
  form: { gap: spacing.md },
})
