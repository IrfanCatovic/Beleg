import { Image, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { computePERForAkcija, formatActionDate, getActionLifecycleBadge } from '@beleg/shared'
import type { AkcijaDetail } from '@beleg/shared'
import { Badge, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface ActionDetailHeroProps {
  akcija: AkcijaDetail
  locationSubtitle: string
  onBack?: () => void
}

export function ActionDetailHero({ akcija, locationSubtitle, onBack }: ActionDetailHeroProps) {
  const isFerrata = akcija.tipAkcije === 'via_ferrata'
  const lifecycleBadge = getActionLifecycleBadge(akcija)
  const dateLabel = formatActionDate(akcija.datum)
  const actionPer = !isFerrata ? computePERForAkcija(akcija) : 0
  const statsParts: string[] = []
  if (!isFerrata && akcija.duzinaStazeKm != null && akcija.duzinaStazeKm > 0) {
    statsParts.push(`${akcija.duzinaStazeKm.toFixed(1)} km`)
  }
  if (!isFerrata && akcija.kumulativniUsponM != null && akcija.kumulativniUsponM > 0) {
    statsParts.push(`${akcija.kumulativniUsponM} m uspon`)
  }
  if (!isFerrata && akcija.visinaVrhM != null && akcija.visinaVrhM > 0) {
    statsParts.push(`${akcija.visinaVrhM} m`)
  }
  if (actionPer > 0) {
    statsParts.push(`${actionPer} PER`)
  }
  const statsSubtitle = statsParts.join(' · ')

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
        <View style={styles.metaRow}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateText}>{dateLabel}</Text>
          </View>
          {akcija.tezina ? (
            <View style={styles.hardBadge}>
              <Text style={styles.hardText}>{akcija.tezina.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.badges}>
          {isFerrata ? <Badge label="Via ferrata" tone="warning" /> : null}
          {akcija.zimskiUspon ? <Badge label="Zimski" tone="muted" /> : null}
          {akcija.javna ? <Badge label="Javna" tone="warning" /> : null}
          {lifecycleBadge === 'cancelled' ? <Badge label="Otkazana" tone="danger" /> : null}
          {lifecycleBadge === 'completed' ? <Badge label="Završena" tone="muted" /> : null}
          {lifecycleBadge == null ? <Badge label="Aktivna" tone="brand" /> : null}
        </View>
        <Text style={styles.title}>{akcija.naziv}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.8)" />
          <Text style={styles.location}>{locationSubtitle}</Text>
        </View>
        {statsSubtitle ? <Text style={styles.stats}>{statsSubtitle}</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { height: 280, backgroundColor: colors.surfaceAlt },
  hero: { width: '100%', height: '100%' },
  heroFallback: { backgroundColor: colors.brand },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
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
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg },
  metaRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  dateBadge: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dateText: { fontSize: 11, fontWeight: '700', color: colors.text },
  hardBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hardText: { fontSize: 10, fontWeight: '800', color: colors.white },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  title: { color: colors.white, fontSize: 22, fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  location: { color: 'rgba(255,255,255,0.85)', fontSize: 13, flex: 1 },
  stats: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4, fontWeight: '600' },
})
