import { useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import {
  fetchFerrataBySlug,
  fetchFerrataUpcomingActions,
  fetchHotelsNearby,
  listGuidesNearby,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { Badge, Button, Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ExploreStackParamList, HomeStackParamList } from '../../navigation/types'
import { navigateToActionDetailFromExplore } from '../../navigation/navigationRef'
import { FerrataGuideBookingModal } from './ferrata/FerrataGuideBookingModal'
import { FerrataGuidesSection } from './ferrata/FerrataGuidesSection'
import { FerrataHotelsSection } from './ferrata/FerrataHotelsSection'
import { FerrataDetailMapSection } from './ferrata/FerrataDetailMapSection'
import { FerrataUpcomingActions } from './ferrata/FerrataUpcomingActions'

type Props =
  | NativeStackScreenProps<ExploreStackParamList, 'FerrataDetail'>
  | NativeStackScreenProps<HomeStackParamList, 'FerrataDetail'>

export default function FerrataDetailScreen({ route, navigation }: Props) {
  const { slug } = route.params
  const [bookOpen, setBookOpen] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['ferrata', slug],
    queryFn: () => fetchFerrataBySlug(client, slug),
  })

  const f = detailQuery.data
  const lat = typeof f?.lat === 'number' ? f.lat : undefined
  const lng = typeof f?.lng === 'number' ? f.lng : undefined
  const ferrataId = f?.id

  const upcomingQuery = useQuery({
    queryKey: ['ferrata', ferrataId, 'upcoming'],
    queryFn: () => fetchFerrataUpcomingActions(client, ferrataId!),
    enabled: !!ferrataId,
  })

  const guidesQuery = useQuery({
    queryKey: ['ferrata', ferrataId, 'guides', lat, lng],
    queryFn: () =>
      listGuidesNearby(client, {
        lat: lat!,
        lng: lng!,
        tourType: 'via_ferrata',
      }),
    enabled: lat != null && lng != null,
  })

  const hotelsQuery = useQuery({
    queryKey: ['ferrata', ferrataId, 'hotels', lat, lng],
    queryFn: () =>
      fetchHotelsNearby(client, {
        lat: lat!,
        lng: lng!,
      }),
    enabled: lat != null && lng != null,
  })

  if (detailQuery.isLoading) {
    return (
      <Screen edges={['left', 'right']}>
        <Loader />
      </Screen>
    )
  }

  if (detailQuery.isError || !f) {
    return (
      <Screen edges={['left', 'right']}>
        <ErrorView message="Ferrata nije učitana." onRetry={() => detailQuery.refetch()} />
      </Screen>
    )
  }

  const gallery = (f as { gallery?: string[]; galerija?: string[] }).gallery ??
    (f as { galerija?: string[] }).galerija ??
    []
  const rawOprema = (f as { obaveznaOprema?: string[] | Array<{ label: string }> }).obaveznaOprema ?? []
  const oprema = rawOprema.map((item) => (typeof item === 'string' ? item : item.label))
  const highlights = (f as { highlights?: string[] }).highlights ?? []
  const opis = (f.opis as string | undefined) || (f.quickTip as string | undefined)
  const region = f.podrucje || f.lokacija || f.drzava
  const mapNote = (f as { mapNote?: string }).mapNote
  const locationSubtitle = [f.drzava, f.gradOpstina].filter(Boolean).join(' · ')
  const trajanje =
    f.trajanjeMin && f.trajanjeMax
      ? `${Math.round(f.trajanjeMin)}–${Math.round(f.trajanjeMax)} min`
      : null

  const navigateToAction = (id: number) => {
    navigateToActionDetailFromExplore(id)
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {f.coverImage ? (
          <Image source={{ uri: f.coverImage }} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.hero, styles.heroFallback]} />
        )}

        <View style={styles.content}>
          <Text variant="title">{f.naziv}</Text>
          {region ? (
            <Text variant="small" color={colors.textMuted}>
              {region}
            </Text>
          ) : null}
          {f.tezina ? <Badge label={f.tezina} tone="brand" /> : null}

          <View style={styles.statsGrid}>
            {f.duzinaM ? <Stat icon="resize-outline" label="Dužina" value={`${f.duzinaM} m`} /> : null}
            {f.visinskaRazlikaM ? (
              <Stat icon="trending-up-outline" label="Uspon" value={`${f.visinskaRazlikaM} m`} />
            ) : null}
            {trajanje ? <Stat icon="time-outline" label="Trajanje" value={trajanje} /> : null}
            {typeof f.upcomingActionsCount === 'number' ? (
              <Stat icon="calendar-outline" label="Akcije" value={String(f.upcomingActionsCount)} />
            ) : null}
          </View>

          {opis ? (
            <Card style={styles.card}>
              <Text variant="label">O ferati</Text>
              <Text variant="body" color={colors.textMuted}>
                {opis}
              </Text>
            </Card>
          ) : null}

          {highlights.length > 0 ? (
            <Card style={styles.card}>
              <Text variant="label">Zašto posetiti</Text>
              {highlights.map((h, i) => (
                <Text key={i} variant="small" color={colors.textMuted}>
                  · {h}
                </Text>
              ))}
            </Card>
          ) : null}

          <FerrataUpcomingActions
            actions={upcomingQuery.data ?? []}
            onPressAction={navigateToAction}
          />

          <FerrataGuidesSection guides={guidesQuery.data ?? []} loading={guidesQuery.isLoading} />

          <FerrataHotelsSection hotels={hotelsQuery.data ?? []} loading={hotelsQuery.isLoading} />

          {lat != null && lng != null ? (
            <FerrataDetailMapSection
              lat={lat}
              lng={lng}
              naziv={f.naziv}
              subtitle={locationSubtitle || undefined}
              routeNote={mapNote}
            />
          ) : null}

          {gallery.length > 0 ? (
            <Card style={styles.card}>
              <Text variant="label">Galerija</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
                {gallery.map((url, i) => (
                  <Image key={i} source={{ uri: url }} style={styles.galleryImg} />
                ))}
              </ScrollView>
            </Card>
          ) : null}

          {oprema.length > 0 ? (
            <Card style={styles.card}>
              <Text variant="label">Obavezna oprema</Text>
              {oprema.map((item, i) => (
                <Text key={i} variant="small" color={colors.textMuted}>
                  · {item}
                </Text>
              ))}
            </Card>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Zakaži vodiča" onPress={() => setBookOpen(true)} fullWidth />
      </View>

      <FerrataGuideBookingModal
        visible={bookOpen}
        onClose={() => setBookOpen(false)}
        ferrataId={f.id}
        ferrataName={f.naziv}
        ferrataLat={lat}
        ferrataLng={lng}
      />
    </Screen>
  )
}

function Stat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={16} color={colors.brand} />
      <Text variant="small" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="label">{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 100 },
  hero: { width: '100%', height: 240 },
  heroFallback: { backgroundColor: '#cbd5e1' },
  content: { padding: spacing.lg, gap: spacing.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
  stat: {
    minWidth: '45%',
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  card: { gap: spacing.sm, marginBottom: spacing.md },
  gallery: { marginTop: spacing.sm },
  galleryImg: { width: 120, height: 90, borderRadius: 8, marginRight: spacing.sm },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
})
