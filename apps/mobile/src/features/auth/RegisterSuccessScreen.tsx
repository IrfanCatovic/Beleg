import { StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Button, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { AuthStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterSuccess'>

export default function RegisterSuccessScreen({ route, navigation }: Props) {
  const email = route.params?.email

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text variant="title" color={colors.brand}>Proverite email</Text>
        <Text color={colors.textMuted} style={styles.body}>
          {email
            ? `Poslali smo verifikacioni link na ${email}. Kliknite na link u poruci pa se prijavite.`
            : 'Poslali smo verifikacioni email. Kliknite na link u poruci pa se prijavite.'}
        </Text>
        <Button title="Idi na prijavu" onPress={() => navigation.navigate('Login')} fullWidth />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.xxl },
  body: { lineHeight: 22 },
})
