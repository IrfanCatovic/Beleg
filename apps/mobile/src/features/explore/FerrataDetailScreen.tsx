import { StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { fetchFerrataBySlug } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { spacing } from '../../theme'
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

  return (
    <Screen scroll>
      <Text variant="title" style={styles.title}>
        {f.naziv}
      </Text>
      <Card style={styles.card}>
        {f.lokacija ? <Text>Lokacija: {f.lokacija}</Text> : null}
        {f.tezina ? <Text>Težina: {f.tezina}</Text> : null}
        {f.duzinaM ? <Text>Dužina: {f.duzinaM} m</Text> : null}
        {f.visinskaRazlikaM ? <Text>Uspon: {f.visinskaRazlikaM} m</Text> : null}
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.md },
  card: { gap: spacing.sm },
})
