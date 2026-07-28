import { StyleSheet, View } from 'react-native'
import { Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'
import type { SummitAspect, SummitLayout, SummitMountainShareData } from '../utils/summitShareData'
import { SUMMIT_ASPECT_SIZE } from '../utils/summitShareData'

/** Logical preview scale — capture uses pixelRatio to reach target PNG size. */
const PREVIEW_SCALE = 0.28

interface Props {
  data: SummitMountainShareData
  aspect: SummitAspect
  layout: SummitLayout
}

export function SummitMountainCaptureView({ data, aspect, layout }: Props) {
  const { width, height } = SUMMIT_ASPECT_SIZE[aspect]
  const w = Math.round(width * PREVIEW_SCALE)
  const h = Math.round(height * PREVIEW_SCALE)
  const isPortrait = aspect === '9:16'
  const brandSize = isPortrait ? 28 : 22
  const titleSize = isPortrait ? 16 : 14
  const labelSize = isPortrait ? 9 : 8
  const valueSize = isPortrait ? 12 : 11

  const metrics = data.metrics
  const mid = Math.ceil(metrics.length / 2)
  const left = layout === 'balanced' ? metrics.slice(0, mid) : metrics
  const right = layout === 'balanced' ? metrics.slice(mid) : []

  return (
    <View
      collapsable={false}
      style={[
        styles.canvas,
        {
          width: w,
          height: h,
          paddingHorizontal: isPortrait ? spacing.lg : spacing.md,
          paddingVertical: isPortrait ? spacing.xl : spacing.md,
        },
      ]}
    >
      <View
        style={[
          styles.content,
          layout === 'stacked' ? styles.contentStacked : styles.contentBalanced,
        ]}
      >
        <Text style={[styles.brand, { fontSize: brandSize }]}>{data.brand}</Text>
        <Text style={[styles.title, { fontSize: titleSize }]} numberOfLines={3}>
          {data.title}
        </Text>

        {layout === 'balanced' ? (
          <View style={styles.balancedRow}>
            <View style={styles.col}>
              {left.map((m) => (
                <View key={`${m.label}-${m.value}`} style={styles.cell}>
                  <Text style={[styles.label, { fontSize: labelSize }]}>{m.label.toUpperCase()}</Text>
                  <Text style={[styles.value, { fontSize: valueSize }]} numberOfLines={2}>
                    {m.value}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.col}>
              {right.map((m) => (
                <View key={`${m.label}-${m.value}`} style={styles.cell}>
                  <Text style={[styles.label, { fontSize: labelSize }]}>{m.label.toUpperCase()}</Text>
                  <Text style={[styles.value, { fontSize: valueSize }]} numberOfLines={2}>
                    {m.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.stacked}>
            {metrics.map((m) => (
              <View key={`${m.label}-${m.value}`} style={styles.cellCenter}>
                <Text style={[styles.label, { fontSize: labelSize }]}>{m.label.toUpperCase()}</Text>
                <Text style={[styles.value, { fontSize: valueSize }]} numberOfLines={2}>
                  {m.value}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  contentBalanced: {
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
  },
  contentStacked: {
    justifyContent: 'center',
  },
  brand: {
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  title: {
    color: colors.white,
    fontWeight: '700',
    textAlign: 'center',
  },
  balancedRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  col: { flex: 1, gap: spacing.sm },
  stacked: { gap: spacing.sm, marginTop: spacing.md },
  cell: { gap: 2 },
  cellCenter: { gap: 2, alignItems: 'center' },
  label: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  value: {
    color: colors.white,
    fontWeight: '700',
  },
})
