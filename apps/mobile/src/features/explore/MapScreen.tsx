import { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { fetchPeaks } from '@beleg/shared/services'
import { client } from '../../api/client'
import { ErrorView, Loader, Screen, Text } from '../../components/ui'
import { spacing } from '../../theme'
import type { ExploreStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ExploreStackParamList, 'Map'>

const DEFAULT_REGION = {
  latitude: 43.85,
  longitude: 18.35,
  latitudeDelta: 4,
  longitudeDelta: 4,
}

export default function MapScreen(_props: Props) {
  const peaksQuery = useQuery({
    queryKey: ['peaks'],
    queryFn: () => fetchPeaks(client),
  })

  const markers = useMemo(
    () => (peaksQuery.data ?? []).filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number'),
    [peaksQuery.data],
  )

  if (peaksQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (peaksQuery.isError) {
    return (
      <Screen>
        <ErrorView message="Vrhovi nisu učitani." onRetry={() => peaksQuery.refetch()} />
      </Screen>
    )
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <Text variant="small" style={styles.hint}>
        {markers.length} vrhova na mapi
      </Text>
      <MapView style={styles.map} initialRegion={DEFAULT_REGION}>
        {markers.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat!, longitude: p.lng! }}
            title={p.naziv}
            description={p.planina ? `${p.planina}${p.visinaM ? ` · ${p.visinaM} m` : ''}` : undefined}
          />
        ))}
      </MapView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  hint: { padding: spacing.md, paddingBottom: 0 },
  map: { flex: 1 },
})
