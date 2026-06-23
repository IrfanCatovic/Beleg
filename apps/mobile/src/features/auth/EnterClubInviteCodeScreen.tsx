import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
import { validateInviteCode } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Button, Input, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { AuthStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AuthStackParamList, 'EnterClubInviteCode'>

export default function EnterClubInviteCodeScreen({ navigation }: Props) {
  const { t } = useTranslation('registration')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const result = await validateInviteCode(client, code)
      if (!result.ok) {
        setError(
          result.error === 'INVALID_FORMAT' ? t('invalidFormat') : result.error || t('invalidCode'),
        )
        return
      }
      navigation.navigate('RegisterMember', {
        klubId: result.klubId,
        klubNaziv: result.klubNaziv,
        inviteCode: code.replace(/\s+/g, '').toUpperCase(),
      })
    } catch (err) {
      setError(getApiErrorMessage(err, t('validateError')))
    } finally {
      setLoading(false)
    }
  }, [code, navigation, t])

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="title" color={colors.brand}>{t('clubCodeTitle')}</Text>
        <Text variant="muted">{t('clubCodeSubtitle')}</Text>
      </View>
      <View style={styles.form}>
        <Input
          label={t('inviteCodeLabel')}
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={setCode}
          placeholder={t('inviteCodePlaceholder')}
        />
        {error ? <Text variant="small" color={colors.danger}>{error}</Text> : null}
        <Button title={t('continue')} loading={loading} onPress={submit} fullWidth />
        <Button title={t('backToLogin')} variant="ghost" onPress={() => navigation.navigate('Login')} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl, gap: spacing.xs },
  form: { gap: spacing.md },
})
