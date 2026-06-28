import { StyleSheet, View } from 'react-native'
import { getActionPriceDisplay } from '@beleg/shared'
import type { AkcijaDetail } from '@beleg/shared'
import { Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface ActionDetailMembershipBannerProps {
  akcija: Pick<AkcijaDetail, 'cenaClan' | 'cenaOstali' | 'javna'>
  isClan: boolean
  isActionHost: boolean
  currency: string
  visible: boolean
}

export function ActionDetailMembershipBanner({
  akcija,
  isClan,
  isActionHost,
  currency,
  visible,
}: ActionDetailMembershipBannerProps) {
  const display = getActionPriceDisplay({
    akcija,
    isClan,
    isActionHost,
    mode: 'banner',
  })

  const hasVisiblePrice =
    display.kind === 'tiers'
      ? display.tiers.some((t) => t.amount > 0)
      : display.amount > 0

  if (!visible || !hasVisiblePrice) return null

  return (
    <View style={[styles.wrap, isClan ? styles.clan : styles.guest]}>
      <View style={styles.textBlock}>
        <Text variant="small" style={[styles.status, isClan ? styles.clanText : styles.guestText]}>
          {isClan ? 'ČLAN KLUBA' : 'GOST'}
        </Text>
      </View>
      {display.kind === 'tiers' ? (
        <View style={styles.tiers}>
          {display.tiers.map((tier) => (
            <View key={tier.label} style={styles.tierRow}>
              <Text variant="small" color={colors.textMuted}>
                {tier.label}
              </Text>
              <Text variant="label" style={isClan ? styles.clanPrice : styles.guestPrice}>
                {tier.amount.toLocaleString('sr-RS')} {currency}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.singlePrice}>
          <Text variant="small" color={colors.textMuted}>
            {display.label}
          </Text>
          <Text variant="heading" style={isClan ? styles.clanPrice : styles.guestPrice}>
            {display.amount.toLocaleString('sr-RS')} {currency}
          </Text>
        </View>
      )}
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
    gap: spacing.sm,
  },
  clan: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  guest: { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' },
  textBlock: { gap: 2 },
  status: { fontWeight: '800', letterSpacing: 0.5 },
  clanText: { color: '#047857' },
  guestText: { color: '#6d28d9' },
  singlePrice: { alignItems: 'flex-end', gap: 2 },
  tiers: { alignItems: 'flex-end', gap: spacing.xs },
  tierRow: { alignItems: 'flex-end', gap: 2 },
  clanPrice: { color: '#047857' },
  guestPrice: { color: '#6d28d9' },
})
