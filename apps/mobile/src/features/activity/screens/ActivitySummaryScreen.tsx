import { useMemo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { fetchActivityById } from '@beleg/shared'
import { client } from '../../../api/client'
import { AppTopBar, Button, Loader, Screen, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'
import type { ExploreStackParamList } from '../../../navigation/types'
import { ActivitySummaryStats } from '../components/ActivitySummaryStats'
import { decodePolyline } from '../services/activityMetrics'

type Props = NativeStackScreenProps<ExploreStackParamList, 'ActivitySummary'>

export default function ActivitySummaryScreen({ navigation, route }: Props) {
  const { activityId } = route.params
  const query = useQuery({
    queryKey: ['activity', activityId],
    queryFn: () => fetchActivityById(client, activityId),
  })

  const coords = useMemo(() => {
    const poly = query.data?.routePolyline
    if (!poly) return []
    return decodePolyline(poly).map((p) => ({ latitude: p.lat, longitude: p.lng }))
  }, [query.data?.routePolyline])

  const region = useMemo(() => {
    if (coords.length === 0) {
      return {
        latitude: 44.0165,
        longitude: 21.0059,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    }
    const lats = coords.map((c) => c.latitude)
    const lngs = coords.map((c) => c.longitude)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.4),
      longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.4),
    }
  }, [coords])

  if (query.isLoading || !query.data) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  const activity = query.data

  return (
    <Screen edges={['left', 'right']}>
      <AppTopBar title="Rezime aktivnosti" leftIcon="chevron-back" onLeftPress={() => navigation.navigate('ExploreHome')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.mapWrap}>
          <MapView style={StyleSheet.absoluteFill} provider={PROVIDER_DEFAULT} region={region}>
            {coords.length > 1 ? (
              <Polyline coordinates={coords} strokeColor={colors.brand} strokeWidth={4} />
            ) : null}
          </MapView>
        </View>
        <ActivitySummaryStats
          durationSec={activity.durationSec}
          distanceM={activity.distanceM}
          elevationGainM={activity.elevationGainM}
          steps={activity.steps}
        />
        <Text variant="small" color={colors.textMuted} style={styles.note}>
          Uspon je procijenjen iz GPS visine i može odstupati od stvarne vrijednosti.
        </Text>
        <Button title="Nazad na Istraži" onPress={() => navigation.navigate('ExploreHome')} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  mapWrap: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  note: { lineHeight: 20 },
})
