import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { registerOpenApi, getApiErrorMessage } from '@beleg/shared'
import { client } from '../../api/client'
import { useModal } from '../../context/ModalContext'
import { Button, DatePickerField, Input, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { AuthStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>

const usernameCharset = /^[a-zA-Z0-9._]+$/

export default function RegisterScreen({ navigation }: Props) {
  const { showAlert } = useModal()
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [pol, setPol] = useState('')
  const [datumRodjenja, setDatumRodjenja] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validate = useCallback((): string | null => {
    const u = username.trim()
    if (u.length < 2 || u.length > 30) return 'Korisničko ime mora imati 2-30 karaktera.'
    if (!usernameCharset.test(u)) return 'Dozvoljena su slova, brojevi, tačka i donja crta.'
    if (password.length < 8) return 'Lozinka mora imati najmanje 8 karaktera.'
    if (password !== confirm) return 'Lozinke se ne poklapaju.'
    if (!email.trim()) return 'Email je obavezan.'
    if (!pol.trim()) return 'Pol je obavezan (npr. muski/zenski).'
    if (!datumRodjenja.trim()) return 'Datum rođenja je obavezan.'
    return null
  }, [username, password, confirm, email, pol, datumRodjenja])

  const submit = useCallback(async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setLoading(true)
    try {
      await registerOpenApi(client, { username, password, pol, datumRodjenja, email, fullName })
      await showAlert('Nalog kreiran', 'Poslali smo verifikacioni email. Proverite inbox pa se prijavite.')
      navigation.navigate('Login')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Registracija nije uspela.'))
    } finally {
      setLoading(false)
    }
  }, [validate, username, password, pol, datumRodjenja, email, fullName, showAlert, navigation])

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="title" color={colors.brand}>Registracija</Text>
        <Text variant="muted">Kreirajte nalog</Text>
      </View>

      <View style={styles.form}>
        <Input label="Korisničko ime" autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} />
        <Input label="Ime i prezime" value={fullName} onChangeText={setFullName} />
        <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Input label="Pol" placeholder="muski / zenski" autoCapitalize="none" value={pol} onChangeText={setPol} />
        <DatePickerField
          label="Datum rođenja"
          value={datumRodjenja || null}
          onChange={(ymd) => setDatumRodjenja(ymd ?? '')}
          preset="birth"
        />
        <Input label="Lozinka" secureTextEntry value={password} onChangeText={setPassword} />
        <Input label="Potvrdi lozinku" secureTextEntry value={confirm} onChangeText={setConfirm} />
        {error ? <Text variant="small" color={colors.danger}>{error}</Text> : null}
        <Button title="Registruj se" loading={loading} onPress={submit} fullWidth />
        <Button title="Nazad na prijavu" variant="ghost" onPress={() => navigation.navigate('Login')} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xl, marginBottom: spacing.lg, gap: spacing.xs },
  form: { gap: spacing.md, paddingBottom: spacing.xxl },
})
