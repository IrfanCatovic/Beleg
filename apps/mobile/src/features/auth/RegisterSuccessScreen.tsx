import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Button, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { AuthStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterSuccess'>

export default function RegisterSuccessScreen({ route, navigation }: Props) {
  const { t } = useTranslation('registration')
  const email = route.params?.email

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text variant="title" color={colors.brand}>{t('successTitle')}</Text>
        <Text color={colors.textMuted} style={styles.body}>
          {email ? t('successBodyWithEmail', { email }) : t('successBody')}
        </Text>
        <Button title={t('goToLogin')} onPress={() => navigation.navigate('Login')} fullWidth />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.xxl },
  body: { lineHeight: 22 },
})
