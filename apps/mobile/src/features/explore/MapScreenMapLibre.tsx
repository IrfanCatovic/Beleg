import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native'
import { Camera, Map, Marker, type CameraRef } from '@maplibre/maplibre-react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { FerrataRow, HotelRow, PeakRow } from '@beleg/shared'
import { getApiErrorMessage } from '@beleg/shared'
import { fetchExploreMapData } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { MapStyleMissing } from '../../components/map/MapStyleMissing'
import { PlaninerMapExploreOverlay } from '../../components/map/planiner/PlaninerMapExploreOverlay'
import {
  FerrataMapMarker,
  HotelMapMarker,
  PeakMapMarker,
} from '../../components/map/planiner/PlaninerMarkers'
import { Button, ErrorView, Loader, Text } from '../../components/ui'
import { getMobilePlaninerMapStyle } from '../../utils/planinerMapStyle'
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

const DEFAULT_CENTER: [number, number] = [21.0059, 44.0165]

export default function MapScreenMapLibre({ navigation }: Props) {
  const { user } = useAuth()
  const cameraRef = useRef<CameraRef>(null)
  const mapStyle = getMobilePlaninerMapStyle()

  const [showFerrate, setShowFerrate] = useState(true)
  const [showHotels, setShowHotels] = useState(true)
  const [showPeaks, setShowPeaks] = useState(true)
  const [active, setActive] = useState<ActivePin>(null)
  const [mapReady, setMapReady] = useState(false)

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

  const visibleFerrate = showFerrate ? ferrate : []
  const visibleHotels = showHotels ? hotels : []
  const visiblePeaks = showPeaks ? peaks : []

  const fitMarkers = useCallback(() => {
    const pts: Array<[number, number]> = [
      ...visibleFerrate.map((m) => [m.lng!, m.lat!] as [number, number]),
      ...visibleHotels.map((m) => [m.lng!, m.lat!] as [number, number]),
      ...visiblePeaks.map((m) => [m.lng!, m.lat!] as [number, number]),
    ]
    if (pts.length === 0) {
      cameraRef.current?.jumpTo({ center: DEFAULT_CENTER, zoom: 6.2 })
      return
    }
    if (pts.length === 1) {
      cameraRef.current?.jumpTo({ center: pts[0], zoom: 11 })
      return
    }
    const lngs = pts.map((p) => p[0])
    const lats = pts.map((p) => p[1])
    cameraRef.current?.fitBounds(
      [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      { padding: { top: 64, right: 64, bottom: 64, left: 64 }, duration: 400 },
    )
  }, [visibleFerrate, visibleHotels, visiblePeaks])

  useEffect(() => {
    if (!mapReady || mapQuery.isLoading) return
    fitMarkers()
  }, [mapReady, mapQuery.isLoading, showFerrate, showHotels, showPeaks, fitMarkers])

  const canCreateFromPeak = canManageActions(user?.role)

  if (!mapStyle) {
    return (
      <View style={styles.root}>
        <MapStyleMissing />
      </View>
    )
  }

  if (mapQuery.isLoading) {
    return (
      <View style={styles.root}>
        <Loader />
      </View>
    )
  }

  if (mapQuery.isError) {
    return (
      <View style={styles.root}>
        <ErrorView
          message={getApiErrorMessage(mapQuery.error, 'Mapa nije učitana.')}
          onRetry={() => mapQuery.refetch()}
        />
      </View>
    )
  }
  return (
    <View style={styles.root}>
      <Map
        style={styles.map}
        mapStyle={mapStyle.styleUrl}
        logo={false}
        attribution
        attributionPosition={{ bottom: 8, left: 8 }}
        onDidFinishLoadingMap={() => setMapReady(true)}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: DEFAULT_CENTER, zoom: 6.2 }}
        />

        {visibleFerrate.map((f) => (
          <Marker
            key={`f-${f.id}`}
            id={`f-${f.id}`}
            lngLat={[f.lng!, f.lat!]}
            anchor="bottom"
            onPress={() => setActive({ kind: 'ferrata', data: f })}
          >
            <FerrataMapMarker active={active?.kind === 'ferrata' && active.data.id === f.id} />
          </Marker>
        ))}

        {visibleHotels.map((h) => (
          <Marker
            key={`h-${h.id}`}
            id={`h-${h.id}`}
            lngLat={[h.lng!, h.lat!]}
            anchor="bottom"
            onPress={() => setActive({ kind: 'hotel', data: h })}
          >
            <HotelMapMarker active={active?.kind === 'hotel' && active.data.id === h.id} />
          </Marker>
        ))}

        {visiblePeaks.map((p) => (
          <Marker
            key={`p-${p.id}`}
            id={`p-${p.id}`}
            lngLat={[p.lng!, p.lat!]}
            anchor="bottom"
            onPress={() => setActive({ kind: 'peak', data: p })}
          >
            <PeakMapMarker active={active?.kind === 'peak' && active.data.id === p.id} />
          </Marker>
        ))}
      </Map>

      <PlaninerMapExploreOverlay
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

function hasCoords(lat?: number, lng?: number): lat is number {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
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

  const heroStyle =
    active.kind === 'ferrata'
      ? styles.heroFerrata
      : active.kind === 'hotel'
        ? styles.heroHotel
        : styles.heroPeak

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.hero, heroStyle]}>
            <Text variant="small" style={styles.heroKicker}>
              {active.kind === 'ferrata' ? 'Ferata' : active.kind === 'hotel' ? 'Hotel' : 'Vrh'}
            </Text>
            <Text variant="heading" style={styles.heroTitle}>
              {active.data.naziv}
            </Text>
          </View>

          {active.kind === 'ferrata' ? (
            <>
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
              <Text variant="small" color={colors.textMuted}>
                {[
                  'planina' in active.data ? active.data.planina : null,
                  active.data.visinaM ? `${active.data.visinaM} m` : null,
                ]
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
  root: { flex: 1, backgroundColor: '#f1f5f9' },
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
  hero: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  heroFerrata: { backgroundColor: '#ecfdf5' },
  heroHotel: { backgroundColor: '#fffbeb' },
  heroPeak: { backgroundColor: '#eef2ff' },
  heroKicker: { fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7 },
  heroTitle: { color: colors.text },
})
