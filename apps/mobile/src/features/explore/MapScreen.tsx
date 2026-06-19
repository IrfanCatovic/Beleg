import { useMemo, useState } from 'react'
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { FerrataRow, HotelRow, PeakRow } from '@beleg/shared'
import { fetchExploreMapData } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { AdventureMapOverlay, MapMarkerPin } from '../../components/map/AdventureMapParts'
import { Button, Loader, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import { canManageActions } from '../../utils/roles'
import type { ExploreStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ExploreStackParamList, 'Map'>

type PinKind = 'ferrata' | 'hotel' | 'peak'

type ActivePin =
  | { kind: 'ferrata'; data: FerrataRow }
  | { kind: 'hotel'; data: HotelRow }
  | { kind: 'peak'; data: PeakRow }
  | null

const DEFAULT_REGION = {
  latitude: 44.0165,
  longitude: 21.0059,
  latitudeDelta: 5,
  longitudeDelta: 5,
}

function hasCoords(lat?: number, lng?: number): lat is number {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
}

export default function MapScreen({ navigation }: Props) {
  const { user } = useAuth()
  const [showFerrate, setShowFerrate] = useState(true)
  const [showHotels, setShowHotels] = useState(true)
  const [showPeaks, setShowPeaks] = useState(true)
  const [active, setActive] = useState<ActivePin>(null)

  const mapQuery = useQuery({
    queryKey: ['explore-map'],
    queryFn: () => fetchExploreMapData(client),
  })

  const ferrate = useMemo(
    () => (mapQuery.data?.ferratas?.ferrate ?? []).filter((f) => hasCoords(f.lat, f.lng)),
    [mapQuery.data],
  )
  const hotels = useMemo(
    () => (mapQuery.data?.hotels?.hotels ?? []).filter((h) => hasCoords(h.lat, h.lng)),
    [mapQuery.data],
  )
  const peaks = useMemo(
    () => (mapQuery.data?.peaks?.peaks ?? []).filter((p) => hasCoords(p.lat, p.lng)),
    [mapQuery.data],
  )

  const canCreateFromPeak = canManageActions(user?.role)

  if (mapQuery.isLoading) {
    return (
      <View style={styles.root}>
        <Loader />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AdventureMapOverlay
        ferrataCount={ferrate.length}
        hotelCount={hotels.length}
        peakCount={peaks.length}
        showFerrate={showFerrate}
        showHotels={showHotels}
        showPeaks={showPeaks}
        onToggleFerrate={() => setShowFerrate((v) => !v)}
        onToggleHotels={() => setShowHotels((v) => !v)}
        onTogglePeaks={() => setShowPeaks((v) => !v)}
      />

      <MapView style={styles.map} initialRegion={DEFAULT_REGION} provider={PROVIDER_DEFAULT}>
        {showFerrate
          ? ferrate.map((f) => (
              <Marker
                key={`f-${f.id}`}
                coordinate={{ latitude: f.lat!, longitude: f.lng! }}
                onPress={() => setActive({ kind: 'ferrata', data: f })}
              >
                <MapMarkerPin variant="ferrata" active={active?.kind === 'ferrata' && active.data.id === f.id} />
              </Marker>
            ))
          : null}
        {showHotels
          ? hotels.map((h) => (
              <Marker
                key={`h-${h.id}`}
                coordinate={{ latitude: h.lat!, longitude: h.lng! }}
                onPress={() => setActive({ kind: 'hotel', data: h })}
              >
                <MapMarkerPin variant="hotel" active={active?.kind === 'hotel' && active.data.id === h.id} />
              </Marker>
            ))
          : null}
        {showPeaks
          ? peaks.map((p) => (
              <Marker
                key={`p-${p.id}`}
                coordinate={{ latitude: p.lat!, longitude: p.lng! }}
                onPress={() => setActive({ kind: 'peak', data: p })}
              >
                <MapMarkerPin variant="peak" active={active?.kind === 'peak' && active.data.id === p.id} />
              </Marker>
            ))
          : null}
      </MapView>

      <PinSheet
        active={active}
        onClose={() => setActive(null)}
        onOpenFerrata={(slug) => {
          setActive(null)
          navigation.navigate('FerrataDetail', { slug })
        }}
        onCreatePeakAction={(peakId) => {
          setActive(null)
          navigation.getParent()?.navigate('ActionsTab', {
            screen: 'ActionWizard',
            params: { tip: 'planina', peakId, organizator: user?.role === 'vodic' ? 'vodic' : undefined },
          })
        }}
        canCreateFromPeak={canCreateFromPeak}
      />
    </View>
  )
}

function PinSheet({
  active,
  onClose,
  onOpenFerrata,
  onCreatePeakAction,
  canCreateFromPeak,
}: {
  active: ActivePin
  onClose: () => void
  onOpenFerrata: (slug: string) => void
  onCreatePeakAction: (peakId: number) => void
  canCreateFromPeak: boolean
}) {
  if (!active) return null

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {active.kind === 'ferrata' ? (
            <>
              <Text variant="heading">{active.data.naziv}</Text>
              <Text variant="small" color={colors.textMuted}>
                {[active.data.podrucje, active.data.tezina].filter(Boolean).join(' · ')}
              </Text>
              {active.data.slug ? (
                <Button title="Pogledaj feratu" onPress={() => onOpenFerrata(active.data.slug!)} fullWidth />
              ) : null}
            </>
          ) : null}

          {active.kind === 'hotel' ? (
            <>
              <Text variant="heading">{active.data.naziv}</Text>
              {active.data.telefon ? (
                <Button
                  title={`Pozovi ${active.data.telefon}`}
                  variant="secondary"
                  onPress={() => void Linking.openURL(`tel:${active.data.telefon}`)}
                  fullWidth
                />
              ) : null}
              {active.data.bookingUrl ? (
                <Button
                  title="Booking"
                  variant="secondary"
                  onPress={() => void Linking.openURL(String(active.data.bookingUrl))}
                  fullWidth
                />
              ) : null}
              {active.data.instagramUrl ? (
                <Button
                  title="Instagram"
                  variant="ghost"
                  onPress={() => void Linking.openURL(String(active.data.instagramUrl))}
                  fullWidth
                />
              ) : null}
            </>
          ) : null}

          {active.kind === 'peak' ? (
            <>
              <Text variant="heading">{active.data.naziv}</Text>
              <Text variant="small" color={colors.textMuted}>
                {[active.data.planina, active.data.visinaM ? `${active.data.visinaM} m` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {canCreateFromPeak ? (
                <Button title="Kreiraj akciju" onPress={() => onCreatePeakAction(active.data.id)} fullWidth />
              ) : null}
            </>
          ) : null}

          <Button title="Zatvori" variant="ghost" onPress={onClose} fullWidth />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navBg },
  map: { flex: 1 },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
})
