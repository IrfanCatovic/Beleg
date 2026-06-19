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

  return (
    <Screen scroll>
      <Text variant="title" style={styles.title}>
        {f.naziv}
      </Text>

      {f.tezina ? <Badge label={f.tezina} tone="brand" /> : null}

      {f.coverImage ? (
        <Image source={{ uri: f.coverImage }} style={styles.cover} resizeMode="cover" />
      ) : null}

      <Card style={styles.card}>
        {f.lokacija ? <Text>Lokacija: {f.lokacija}</Text> : null}
        {f.drzava ? <Text>Država: {f.drzava}</Text> : null}
        {f.gradOpstina ? <Text>Grad/opština: {f.gradOpstina}</Text> : null}
        {f.duzinaM ? <Text>Dužina: {f.duzinaM} m</Text> : null}
        {f.visinskaRazlikaM ? <Text>Uspon: {f.visinskaRazlikaM} m</Text> : null}
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
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.sm },
  cover: { width: '100%', height: 200, borderRadius: 12, marginVertical: spacing.md },
  card: { gap: spacing.sm, marginBottom: spacing.md },
  gallery: { marginTop: spacing.sm },
  galleryImg: { width: 120, height: 90, borderRadius: 8, marginRight: spacing.sm },
})
