import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('registration')
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
      setError(getApiErrorMessage(err, t('registerError')))
    } finally {
      setLoading(false)
    }
  }, [form, confirm, inviteCode, klubId, navigation, t])

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="title" color={colors.brand}>{t('memberTitle')}</Text>
        <Card style={styles.clubCard}>
          <Text variant="small" color={colors.brand}>{t('clubLabel')}</Text>
          <Text variant="heading">{klubNaziv ?? `ID ${klubId}`}</Text>
        </Card>
      </View>

      <View style={styles.form}>
        <Input label={t('username')} autoCapitalize="none" value={form.username} onChangeText={(v) => patch('username', v)} />
        <Input label={t('password')} secureTextEntry value={form.password} onChangeText={(v) => patch('password', v)} />
        <Input label={t('confirmPassword')} secureTextEntry value={confirm} onChangeText={setConfirm} />
        <Input label={t('email')} autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => patch('email', v)} />
        <Input label={t('fullName')} value={form.fullName} onChangeText={(v) => patch('fullName', v)} />
        <Input label={t('gender')} placeholder={t('genderPlaceholder')} value={form.pol} onChangeText={(v) => patch('pol', v)} />
        <DatePickerField
          label={t('birthDate')}
          value={form.datumRodjenja || null}
          onChange={(ymd) => patch('datumRodjenja', ymd ?? '')}
          preset="birth"
        />
        <Input label={t('phone')} keyboardType="phone-pad" value={form.telefon} onChangeText={(v) => patch('telefon', v)} />
        <Input label={t('address')} value={form.adresa} onChangeText={(v) => patch('adresa', v)} />
        <Input label={t('hikingId')} value={form.brojPlaninarskeLegitimacije} onChangeText={(v) => patch('brojPlaninarskeLegitimacije', v)} />
        <Input label={t('hikingBadge')} value={form.brojPlaninarskeMarkice} onChangeText={(v) => patch('brojPlaninarskeMarkice', v)} />
        {error ? <Text variant="small" color={colors.danger}>{error}</Text> : null}
        <Button title={t('register')} loading={loading} onPress={submit} fullWidth />
        <Button title={t('back')} variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.lg, marginBottom: spacing.md, gap: spacing.md },
  clubCard: { gap: spacing.xs },
  form: { gap: spacing.md, paddingBottom: spacing.xxl },
})
