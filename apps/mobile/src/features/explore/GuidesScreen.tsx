import { FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { listGuidesCatalog } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Card, EmptyState, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ExploreStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ExploreStackParamList, 'Guides'>

type GuideItem = { id?: number; username?: string; fullName?: string; bio?: string }

export default function GuidesScreen({ navigation }: Props) {
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

  const items = (guidesQuery.data ?? []) as GuideItem[]

  return (
    <Screen padded={false}>
      <FlatList
        data={items}
        keyExtractor={(item, i) => String(item.id ?? item.username ?? i)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={guidesQuery.isRefetching} onRefresh={() => guidesQuery.refetch()} />}
        ListEmptyComponent={<EmptyState title="Nema vodiča" />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              if (item.username || item.id) {
                navigation.navigate('UserProfile', {
                  username: item.username,
                  id: item.id,
                })
              }
            }}
          >
            <Card style={styles.card}>
              <Text variant="label">{item.fullName || item.username || 'Vodič'}</Text>
              {item.bio ? <Text variant="small" color={colors.textMuted}>{item.bio}</Text> : null}
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  card: { marginBottom: spacing.sm, gap: spacing.xs },
})
