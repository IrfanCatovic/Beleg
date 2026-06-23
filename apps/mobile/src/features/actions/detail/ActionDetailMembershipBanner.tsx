import { StyleSheet, View } from 'react-native'
import { Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface ActionDetailMembershipBannerProps {
  isClan: boolean
  baseCena: number
  currency: string
  visible: boolean
}

export function ActionDetailMembershipBanner({
  isClan,
  baseCena,
  currency,
  visible,
}: ActionDetailMembershipBannerProps) {
  if (!visible || baseCena <= 0) return null

  return (
    <View style={[styles.wrap, isClan ? styles.clan : styles.guest]}>
      <View style={styles.textBlock}>
        <Text variant="small" style={[styles.status, isClan ? styles.clanText : styles.guestText]}>
          {isClan ? 'ČLAN KLUBA' : 'GOST'}
        </Text>
        <Text variant="small" color={colors.textMuted}>
          {isClan ? 'Vaša osnovna cena kao član' : 'Cena za goste / van kluba'}
        </Text>
      </View>
      <Text variant="heading" style={isClan ? styles.clanPrice : styles.guestPrice}>
        {baseCena.toLocaleString('sr-RS')} {currency}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: 14,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  clan: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  guest: { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' },
  textBlock: { flex: 1, gap: 2 },
  status: { fontWeight: '800', letterSpacing: 0.5 },
  clanText: { color: '#047857' },
  guestText: { color: '#6d28d9' },
  clanPrice: { color: '#047857' },
  guestPrice: { color: '#6d28d9' },
})
