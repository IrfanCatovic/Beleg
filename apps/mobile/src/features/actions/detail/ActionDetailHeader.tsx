import { Image, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AkcijaDetail } from '@beleg/shared'
import { Badge, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface ActionDetailHeaderProps {
  akcija: AkcijaDetail
  locationSubtitle: string
  onBack?: () => void
}

export function ActionDetailHeader({ akcija, locationSubtitle, onBack }: ActionDetailHeaderProps) {
  const isFerrata = akcija.tipAkcije === 'via_ferrata'

  return (
    <View style={styles.wrap}>
      {akcija.slikaUrl ? (
        <Image source={{ uri: akcija.slikaUrl }} style={styles.hero} resizeMode="cover" />
      ) : (
        <View style={[styles.hero, styles.heroFallback]} />
      )}
      <View style={styles.overlay} />
      {onBack ? (
        <Pressable style={styles.backBtn} onPress={onBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </Pressable>
      ) : null}
      <View style={styles.bottom}>
        <View style={styles.badges}>
          {isFerrata ? <Badge label="Via ferrata" tone="warning" /> : null}
          {akcija.zimskiUspon ? <Badge label="Zimski" tone="muted" /> : null}
          {akcija.javna ? <Badge label="Javna" tone="warning" /> : null}
          {akcija.isCompleted ? <Badge label="Završena" tone="muted" /> : null}
          {!akcija.isCompleted ? <Badge label="Aktivna" tone="brand" /> : null}
        </View>
        <Text style={styles.title}>{akcija.naziv}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.8)" />
          <Text style={styles.location}>{locationSubtitle}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { height: 260, backgroundColor: colors.surfaceAlt },
  hero: { width: '100%', height: '100%' },
  heroFallback: { backgroundColor: colors.brand },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backBtn: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  title: { color: colors.white, fontSize: 22, fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  location: { color: 'rgba(255,255,255,0.85)', fontSize: 13, flex: 1 },
})
