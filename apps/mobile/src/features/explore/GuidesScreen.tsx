import { FlatList, RefreshControl, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { listGuidesCatalog } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Card, EmptyState, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { spacing } from '../../theme'
import type { ExploreStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ExploreStackParamList, 'Guides'>

export default function GuidesScreen(_props: Props) {
  const guidesQuery = useQuery({
    queryKey: ['guides'],
    queryFn: () => listGuidesCatalog(client, { limit: 50 }),
  })

  if (guidesQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (guidesQuery.isError) {
    return (
      <Screen>
        <ErrorView message="Vodiči nisu učitani." onRetry={() => guidesQuery.refetch()} />
      </Screen>
    )
  }

  const items = guidesQuery.data ?? []

  return (
    <Screen padded={false}>
      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={guidesQuery.isRefetching} onRefresh={() => guidesQuery.refetch()} />}
        ListEmptyComponent={<EmptyState title="Nema vodiča" />}
        renderItem={({ item }) => {
          const g = item as { fullName?: string; username?: string; bio?: string }
          return (
            <Card style={styles.card}>
              <Text variant="label">{g.fullName || g.username || 'Vodič'}</Text>
              {g.bio ? <Text variant="small">{g.bio}</Text> : null}
            </Card>
          )
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  card: { marginBottom: spacing.sm, gap: spacing.xs },
})
