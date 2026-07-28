import { Image, StyleSheet, View } from 'react-native'
import { Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'
import type { SummitFerrataShareData } from '../utils/summitShareData'
import ferateBedz from '../../../../assets/summit/FerateBedz.png'
import djurdjevicaBedz from '../../../../assets/summit/DjurdjevicaBedz.png'

const BADGE_W = 270
const BADGE_H = Math.round((1448 / 1086) * BADGE_W)

interface Props {
  data: SummitFerrataShareData
}

export function SummitFerrataCaptureView({ data }: Props) {
  const source = data.badgeVariant === 'djurdjevica' ? djurdjevicaBedz : ferateBedz
  return (
    <View collapsable={false} style={styles.wrap}>
      <Image source={source} style={styles.badge} resizeMode="contain" />
      <View style={styles.overlay}>
        <Text style={styles.name} numberOfLines={2}>
          {data.name}
        </Text>
        <Text style={styles.meta}>{data.dateLabel}</Text>
        <Text style={styles.meta}>{data.difficultyLabel}</Text>
        <Text style={styles.brand}>{data.brand}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: BADGE_W,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  badge: {
    width: BADGE_W,
    height: BADGE_H,
  },
  overlay: {
    marginTop: spacing.sm,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
  },
  name: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  meta: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  brand: {
    marginTop: spacing.xs,
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 2,
    fontSize: 18,
  },
})
