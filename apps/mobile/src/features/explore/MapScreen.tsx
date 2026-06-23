import { useEffect, useState, type ComponentType } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Loader, Screen } from '../../components/ui'
import { isMapLibreAvailable } from '../../utils/nativeFeatures'
import type { ExploreStackParamList } from '../../navigation/types'
import MapScreenFallback from './MapScreenFallback'

type Props = NativeStackScreenProps<ExploreStackParamList, 'Map'>

export default function MapScreen(props: Props) {
  const [MapLibreScreen, setMapLibreScreen] = useState<ComponentType<Props> | null>(null)

  useEffect(() => {
    if (!isMapLibreAvailable()) return
    void import('./MapScreenMapLibre').then((m) => setMapLibreScreen(() => m.default))
  }, [])

  if (!isMapLibreAvailable()) {
    return <MapScreenFallback navigation={props.navigation} />
  }

  if (!MapLibreScreen) {
    return (
      <Screen edges={['left', 'right']}>
        <Loader />
      </Screen>
    )
  }

  return <MapLibreScreen {...props} />
}
