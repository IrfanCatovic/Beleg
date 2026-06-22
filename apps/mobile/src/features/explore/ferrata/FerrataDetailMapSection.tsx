import { Linking, Pressable, StyleSheet, View } from 'react-native'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
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

export function FerrataDetailMapSection({
  lat,
  lng,
  naziv,
  subtitle,
  routeNote,
  embed,
}: FerrataDetailMapSectionProps) {
  const region = {
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  }

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
        <MapView
          style={[styles.map, embed && styles.mapEmbed]}
          provider={PROVIDER_DEFAULT}
          initialRegion={region}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          pointerEvents="none"
        >
          <Marker coordinate={{ latitude: lat, longitude: lng }} title={naziv} />
        </MapView>
        <View style={styles.mapOverlay} pointerEvents="none" />
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
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
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
