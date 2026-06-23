import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
import { registerClubMember } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Button, ChipRow, DatePickerField, Input, Screen, Text } from '../../components/ui'
import { getRoleLabel } from '../../utils/profileRank'
import { colors, spacing } from '../../theme'
import type { ClubStackParamList } from '../../navigation/types'
import {
  buildMemberFormData,
  emptyMemberForm,
  validateMemberForm,
} from '../auth/memberRegistrationForm'
import { clubMemberKeys } from './queryKeys'

type Props = NativeStackScreenProps<ClubStackParamList, 'RegisterClubMember'>

const ROLE_OPTIONS =
  ['clan', 'vodic', 'blagajnik', 'sekretar', 'menadzer-opreme', 'admin'] as const

export default function RegisterClubMemberScreen({ navigation }: Props) {
  const { t } = useTranslation('clubAdmin')
  const { user } = useAuth()
  const { showAlert } = useModal()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ ...emptyMemberForm(), role: 'clan' })
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const roleOptions = user?.role === 'superadmin' || user?.role === 'admin'
    ? ROLE_OPTIONS
    : (['clan', 'vodic', 'blagajnik', 'sekretar', 'menadzer-opreme'] as const)

  const patch = useCallback((key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const submit = useCallback(async () => {
    const validationError = validateMemberForm(form, confirm)
    if (validationError) {
      setError(validationError)
      return
    }
    if (!form.role?.trim()) {
      setError(t('selectRole'))
      return
    }
    setError('')
    setLoading(true)
    try {
      const fd = buildMemberFormData(form, { role: form.role })
      await registerClubMember(client, fd)
      await queryClient.invalidateQueries({ queryKey: clubMemberKeys.all })
      await showAlert(t('success'), t('registerSuccess'))
      navigation.goBack()
    } catch (err) {
      setError(getApiErrorMessage(err, t('registerError')))
    } finally {
      setLoading(false)
    }
  }, [form, confirm, navigation, showAlert, queryClient, t])

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="title" color={colors.brand}>{t('addMemberTitle')}</Text>
        <Text variant="muted">{t('addMemberSubtitle')}</Text>
      </View>
      <View style={styles.form}>
        <ChipRow
          label={t('roleLabel')}
          options={roleOptions.map((r) => ({ value: r, label: getRoleLabel(r) }))}
          value={form.role ?? 'clan'}
          onChange={(v) => patch('role', v)}
        />
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
        <Input label="Telefon" value={form.telefon} onChangeText={(v) => patch('telefon', v)} />
        {error ? <Text variant="small" color={colors.danger}>{error}</Text> : null}
        <Button title={t('registerMember')} loading={loading} onPress={submit} fullWidth />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.lg, marginBottom: spacing.md, gap: spacing.xs },
  form: { gap: spacing.md, paddingBottom: spacing.xxl },
})
