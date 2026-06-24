import { Image, Linking, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Card, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'

interface FerrataDetailMapSectionProps {
  lat: number
  lng: number
  naziv: string
  subtitle?: string
  routeNote?: string
  /** U modalu smeštaja — bez spoljašnje kartice. */
  embed?: boolean
}

function googleMapsDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`
}

function mapTilerStaticUrl(lat: number, lng: number): string | null {
  const key = process.env.EXPO_PUBLIC_MAPTILER_API_KEY?.trim()
  if (!key) return null
  const w = 640
  const h = 320
  return `https://api.maptiler.com/maps/streets-v2/static/${lng},${lat},12/${w}x${h}.png?key=${encodeURIComponent(key)}&markers=${lng},${lat},red`
}

export function FerrataDetailMapSection({
  lat,
  lng,
  naziv,
  subtitle,
  routeNote,
  embed,
}: FerrataDetailMapSectionProps) {
  const staticMapUri = mapTilerStaticUrl(lat, lng)

  const openDirections = () => {
    void Linking.openURL(googleMapsDirectionsUrl(lat, lng))
  }

  const route = routeNote?.trim()

  const content = (
    <>
      {!embed ? (
        <View style={styles.titleRow}>
          <Ionicons name="map-outline" size={18} color={colors.brand} />
          <Text variant="label">Lokacija</Text>
        </View>
      ) : null}

      {!embed && subtitle ? (
        <Text variant="small" color={colors.textMuted}>
          {subtitle}
        </Text>
      ) : null}

      <Pressable onPress={openDirections} style={[styles.mapWrap, embed && styles.mapWrapEmbed]}>
        {staticMapUri ? (
          <Image source={{ uri: staticMapUri }} style={[styles.map, embed && styles.mapEmbed]} resizeMode="cover" />
        ) : (
          <View style={[styles.mapPlaceholder, embed && styles.mapEmbed]}>
            <Ionicons name="location-outline" size={28} color={colors.brand} />
            <Text variant="small" color={colors.textMuted} style={styles.mapLabel}>
              {naziv}
            </Text>
            <Text variant="small" color={colors.textSubtle}>
              {lat.toFixed(4)}, {lng.toFixed(4)}
            </Text>
          </View>
        )}
      </Pressable>

      {!embed && route ? (
        <View style={styles.routeBox}>
          <Text variant="small" color={colors.brandDark}>
            Kako stići
          </Text>
          <Text variant="body" color={colors.textMuted}>
            {route}
          </Text>
        </View>
      ) : null}

      {!embed ? (
        <Pressable style={styles.routeBtn} onPress={openDirections}>
          <Ionicons name="navigate-outline" size={18} color={colors.brandDark} />
          <Text variant="label" color={colors.brandDark}>
            Putanja
          </Text>
        </Pressable>
      ) : null}
    </>
  )

  if (embed) {
    return <View style={styles.embed}>{content}</View>
  }

  return <Card style={styles.card}>{content}</Card>
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  embed: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mapWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  mapWrapEmbed: { marginTop: spacing.xs },
  map: { width: '100%', height: 200 },
  mapEmbed: { height: 160 },
  mapPlaceholder: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  mapLabel: { textAlign: 'center' },
  routeBox: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  routeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
  },
})
