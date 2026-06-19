import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { requestPasswordResetApi, getApiErrorMessage } from '@beleg/shared'
import { client } from '../../api/client'
import { Button, Input, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { AuthStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = useCallback(async () => {
    if (!email.trim()) {
      setError('Unesite email.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await requestPasswordResetApi(client, email)
      setMessage('Ako nalog postoji, poslali smo link za reset lozinke na email.')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Zahtev nije uspeo.'))
    } finally {
      setLoading(false)
    }
  }, [email])

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="title" color={colors.brand}>Zaboravljena lozinka</Text>
        <Text variant="muted">Poslaćemo link za reset na vaš email</Text>
      </View>

      <View style={styles.form}>
        <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        {message ? <Text variant="small" color={colors.success}>{message}</Text> : null}
        {error ? <Text variant="small" color={colors.danger}>{error}</Text> : null}
        <Button title="Pošalji" loading={loading} onPress={submit} fullWidth />
        <Button title="Nazad na prijavu" variant="ghost" onPress={() => navigation.navigate('Login')} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.lg, gap: spacing.xs },
  form: { gap: spacing.md },
})
