import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, Card, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import { openWhatsAppWithMessage } from '../../utils/openWhatsApp'
import { getRegisterUrl } from '../../utils/webBaseUrl'

export function InviteFriendsCard() {
  const { t } = useTranslation('home')

  const handleInvite = async () => {
    const registerUrl = getRegisterUrl()
    const message =
      `Hej! Ja koristim Planiner.\n` +
      `Pridruži se: registruj se ovde ${registerUrl}`
    await openWhatsAppWithMessage(message)
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>+</Text>
        </View>
        <Text variant="small" color={colors.brand} style={styles.title}>
          {t('inviteTitle')}
        </Text>
      </View>
      <Text variant="small" color={colors.textMuted} style={styles.desc}>
        {t('inviteDesc')}
      </Text>
      <Button title={t('inviteWhatsApp')} onPress={() => void handleInvite()} variant="primary" />
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    marginRight: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  title: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  desc: { marginBottom: spacing.md, flex: 1 },
})
