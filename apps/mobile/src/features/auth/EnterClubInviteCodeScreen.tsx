import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
import { validateInviteCode } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Button, Input, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { AuthStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AuthStackParamList, 'EnterClubInviteCode'>

export default function EnterClubInviteCodeScreen({ navigation }: Props) {
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
          result.error === 'INVALID_FORMAT'
            ? 'Kod mora imati tačno 8 karaktera (slova i brojevi).'
            : result.error || 'Kod nije validan.',
        )
        return
      }
      navigation.navigate('RegisterMember', {
        klubId: result.klubId,
        klubNaziv: result.klubNaziv,
        inviteCode: code.replace(/\s+/g, '').toUpperCase(),
      })
    } catch (err) {
      setError(getApiErrorMessage(err, 'Provera koda nije uspela.'))
    } finally {
      setLoading(false)
    }
  }, [code, navigation])

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="title" color={colors.brand}>Kod kluba</Text>
        <Text variant="muted">Unesite invite kod koji ste dobili od kluba.</Text>
      </View>
      <View style={styles.form}>
        <Input
          label="Invite kod"
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={setCode}
          placeholder="ABCD1234"
        />
        {error ? <Text variant="small" color={colors.danger}>{error}</Text> : null}
        <Button title="Nastavi" loading={loading} onPress={submit} fullWidth />
        <Button title="Nazad na prijavu" variant="ghost" onPress={() => navigation.navigate('Login')} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl, gap: spacing.xs },
  form: { gap: spacing.md },
})
