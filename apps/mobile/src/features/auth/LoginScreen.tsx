import { useCallback, useState } from 'react'
import { StyleSheet, Switch, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { loginApi, getApiErrorMessage } from '@beleg/shared'
import { client, setAuthToken } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Button, Input, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { AuthStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>

export default function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation('auth')
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await loginApi(client, username, password)
      if (data.token) await setAuthToken(data.token)
      login(data, rememberMe)
    } catch (err) {
      if (axios.isAxiosError(err) && !err.response) {
        setError(t('noConnection'))
      } else if (axios.isAxiosError(err) && err.response?.status === 404) {
        setError('Server nije pronađen (404). Proverite EXPO_PUBLIC_API_URL.')
      } else {
        setError(getApiErrorMessage(err, t('loginFailed')))
      }
    } finally {
      setLoading(false)
    }
  }, [username, password, login, rememberMe, t])

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text variant="title" color={colors.text}>
          {t('loginTitle')}
        </Text>
        <Text variant="muted">{t('loginSubtitle')}</Text>
      </View>

      <View style={styles.form}>
        <Input
          label={t('username')}
          placeholder="korisnicko_ime"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />
        <Input
          label={t('password')}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
        />
        <View style={styles.rememberRow}>
          <Text variant="body">Zapamti me</Text>
          <Switch value={rememberMe} onValueChange={setRememberMe} trackColor={{ true: colors.brand }} />
        </View>
        {error ? (
          <Text variant="small" color={colors.danger}>
            {error}
          </Text>
        ) : null}
        <Button title={t('login')} loading={loading} onPress={handleLogin} fullWidth />
        <Button title={t('forgotPassword')} variant="ghost" onPress={() => navigation.navigate('ForgotPassword')} />
        <Button title={t('register')} variant="ghost" onPress={() => navigation.navigate('Register')} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl, gap: spacing.xs },
  form: { gap: spacing.md },
  rememberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
