import { Image, ScrollView, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { fetchFerrataBySlug } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Badge, Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ExploreStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ExploreStackParamList, 'FerrataDetail'>

export default function FerrataDetailScreen({ route }: Props) {
  const { slug } = route.params

  const detailQuery = useQuery({
    queryKey: ['ferrata', slug],
    queryFn: () => fetchFerrataBySlug(client, slug),
  })

  if (detailQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <Screen>
        <ErrorView message="Ferrata nije učitana." onRetry={() => detailQuery.refetch()} />
      </Screen>
    )
  }

  const f = detailQuery.data
  const gallery = (f as { gallery?: string[] }).gallery ?? []
  const oprema = (f as { obaveznaOprema?: string[] }).obaveznaOprema ?? []
  const opis = (f.opis as string | undefined) || (f.quickTip as string | undefined)
  const region = f.podrucje || f.lokacija || f.drzava
  const trajanje =
    f.trajanjeMin && f.trajanjeMax
      ? `${Math.round(f.trajanjeMin)}–${Math.round(f.trajanjeMax)} min`
      : null

  return (
    <Screen scroll padded={false}>
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
          {f.duzinaM ? <Stat label="Dužina" value={`${f.duzinaM} m`} /> : null}
          {f.visinskaRazlikaM ? <Stat label="Uspon" value={`${f.visinskaRazlikaM} m`} /> : null}
          {trajanje ? <Stat label="Trajanje" value={trajanje} /> : null}
          {typeof f.upcomingActionsCount === 'number' ? (
            <Stat label="Akcije" value={String(f.upcomingActionsCount)} />
          ) : null}
        </View>

        {opis ? (
          <Card style={styles.card}>
            <Text variant="label">Opis</Text>
            <Text variant="body" color={colors.textMuted}>
              {opis}
            </Text>
          </Card>
        ) : null}

        <Card style={styles.card}>
          {f.drzava ? <Text>Država: {f.drzava}</Text> : null}
          {f.gradOpstina ? <Text>Grad/opština: {f.gradOpstina}</Text> : null}
          {typeof f.lat === 'number' && typeof f.lng === 'number' ? (
            <Text color={colors.textMuted}>
              Koordinate: {f.lat.toFixed(4)}, {f.lng.toFixed(4)}
            </Text>
          ) : null}
        </Card>

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
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="small" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="label">{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 220 },
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
})
