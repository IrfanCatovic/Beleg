import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
import { registerMemberByInvite } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Button, Card, DatePickerField, Input, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { AuthStackParamList } from '../../navigation/types'
import {
  buildMemberFormData,
  emptyMemberForm,
  validateMemberForm,
} from './memberRegistrationForm'

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterMember'>

export default function RegisterMemberScreen({ route, navigation }: Props) {
  const { klubId, klubNaziv, inviteCode } = route.params
  const [form, setForm] = useState(emptyMemberForm)
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const patch = useCallback((key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const submit = useCallback(async () => {
    const validationError = validateMemberForm(form, confirm)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setLoading(true)
    try {
      const fd = buildMemberFormData(form, { inviteCode, klubId })
      await registerMemberByInvite(client, fd)
      navigation.replace('RegisterSuccess', { email: form.email.trim().toLowerCase() })
    } catch (err) {
      setError(getApiErrorMessage(err, 'Registracija nije uspela.'))
    } finally {
      setLoading(false)
    }
  }, [form, confirm, inviteCode, klubId, navigation])

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="title" color={colors.brand}>Registracija člana</Text>
        <Card style={styles.clubCard}>
          <Text variant="small" color={colors.brand}>Klub</Text>
          <Text variant="heading">{klubNaziv ?? `ID ${klubId}`}</Text>
        </Card>
      </View>

      <View style={styles.form}>
        <Input label="Korisničko ime *" autoCapitalize="none" value={form.username} onChangeText={(v) => patch('username', v)} />
        <Input label="Lozinka *" secureTextEntry value={form.password} onChangeText={(v) => patch('password', v)} />
        <Input label="Potvrdi lozinku *" secureTextEntry value={confirm} onChangeText={setConfirm} />
        <Input label="Email *" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => patch('email', v)} />
        <Input label="Ime i prezime" value={form.fullName} onChangeText={(v) => patch('fullName', v)} />
        <Input label="Pol *" placeholder="M / Ž" value={form.pol} onChangeText={(v) => patch('pol', v)} />
        <DatePickerField
          label="Datum rođenja *"
          value={form.datumRodjenja || null}
          onChange={(ymd) => patch('datumRodjenja', ymd ?? '')}
          preset="birth"
        />
        <Input label="Telefon" keyboardType="phone-pad" value={form.telefon} onChangeText={(v) => patch('telefon', v)} />
        <Input label="Adresa" value={form.adresa} onChangeText={(v) => patch('adresa', v)} />
        <Input label="Broj planinarske legitimacije" value={form.brojPlaninarskeLegitimacije} onChangeText={(v) => patch('brojPlaninarskeLegitimacije', v)} />
        <Input label="Broj planinarske markice" value={form.brojPlaninarskeMarkice} onChangeText={(v) => patch('brojPlaninarskeMarkice', v)} />
        {error ? <Text variant="small" color={colors.danger}>{error}</Text> : null}
        <Button title="Registruj se" loading={loading} onPress={submit} fullWidth />
        <Button title="Nazad" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.lg, marginBottom: spacing.md, gap: spacing.md },
  clubCard: { gap: spacing.xs },
  form: { gap: spacing.md, paddingBottom: spacing.xxl },
})
