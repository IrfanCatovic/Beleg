import { Image, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { FerrataRow } from '@beleg/shared'
import { Card, Text } from '../ui'
import { colors, radius, spacing } from '../../theme'

interface FerrataCardProps {
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

export function FerrataCard({ ferrata, onPress }: FerrataCardProps) {
  const region = ferrata.podrucje || ferrata.lokacija || ferrata.drzava
  const trajanje =
    ferrata.trajanjeMin && ferrata.trajanjeMax
      ? `${Math.round(ferrata.trajanjeMin)}–${Math.round(ferrata.trajanjeMax)} min`
      : null

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.imageWrap}>
          {ferrata.coverImage ? (
            <Image source={{ uri: ferrata.coverImage }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imageFallback]} />
          )}
          <View style={styles.imageOverlay} />
          <View style={styles.activeBadge}>
            <Text style={styles.activeText}>Aktivna</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text variant="label">{ferrata.naziv}</Text>
          {region ? (
            <Text variant="small" color={colors.textMuted}>
              {region}
            </Text>
          ) : null}

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
            {trajanje ? (
              <View style={styles.chipMuted}>
                <Text variant="small" color={colors.textMuted}>
                  {trajanje}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.footer}>
            {typeof ferrata.upcomingActionsCount === 'number' && ferrata.upcomingActionsCount > 0 ? (
              <Text variant="small" color={colors.brand}>
                {ferrata.upcomingActionsCount} zakazane akcije
              </Text>
            ) : (
              <Text variant="small" color={colors.textSubtle}>
                Nema zakazanih akcija
              </Text>
            )}
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </View>
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, padding: 0, overflow: 'hidden' },
  imageWrap: { height: 160, backgroundColor: colors.surfaceAlt },
  image: { width: '100%', height: '100%' },
  imageFallback: { backgroundColor: '#cbd5e1' },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  activeBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  activeText: { fontSize: 10, fontWeight: '700', color: colors.brand },
  body: { padding: spacing.md, gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  chipText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  chipMuted: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
})
