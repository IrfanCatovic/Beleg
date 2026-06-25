import { Image, Pressable, StyleSheet, View } from 'react-native'
import type { FerrataRow } from '@beleg/shared'
import { Text } from '../../components/ui'
import { feedBlockStyle, feedContentPadding } from '../../components/shared/feedStyles'
import { colors, radius, spacing } from '../../theme'

interface HomeFeedFerrataCardProps {
  ferrata: FerrataRow
  onPress?: () => void
}

function difficultyColor(tezina?: string) {
  const s = (tezina ?? '').toUpperCase()
  if (s.includes('E')) return '#18181b'
  if (s.includes('D')) return '#e11d48'
  if (s.includes('C')) return '#f59e0b'
  if (s.includes('B')) return '#0284c7'
  if (s.includes('A')) return '#059669'
  return colors.textMuted
}

export function HomeFeedFerrataCard({ ferrata, onPress }: HomeFeedFerrataCardProps) {
  const region = ferrata.podrucje || ferrata.lokacija || ferrata.drzava

  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <View style={styles.heroWrap}>
        {ferrata.coverImage ? (
          <Image source={{ uri: ferrata.coverImage }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImage, styles.heroFallback]} />
        )}
        <View style={styles.heroOverlay} />
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>{ferrata.naziv}</Text>
          {region ? (
            <Text style={styles.heroRegion} numberOfLines={1}>
              {region}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.chips}>
          {ferrata.tezina ? (
            <View style={[styles.chip, { backgroundColor: difficultyColor(ferrata.tezina) }]}>
              <Text style={styles.chipText}>{ferrata.tezina}</Text>
            </View>
          ) : null}
          {ferrata.duzinaM ? (
            <View style={styles.chipMuted}>
              <Text variant="small" color={colors.textMuted}>
                {ferrata.duzinaM} m
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    ...feedBlockStyle,
  },
  heroWrap: { height: 200, backgroundColor: colors.surfaceAlt },
  heroImage: { width: '100%', height: '100%' },
  heroFallback: { backgroundColor: '#cbd5e1' },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  heroText: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  heroTitle: { color: colors.white, fontSize: 18, fontWeight: '700' },
  heroRegion: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4 },
  body: { paddingHorizontal: feedContentPadding, paddingVertical: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  chipText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  chipMuted: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
})
