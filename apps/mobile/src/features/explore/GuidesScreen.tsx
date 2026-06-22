import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { listGuidesCatalog, type GuideNearbyPublic } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Avatar, Card, EmptyState, ErrorView, Loader, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ExploreStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ExploreStackParamList, 'Guides'>

function guideName(g: GuideNearbyPublic): string {
  return g.user?.fullName || g.user?.username || g.naslov || 'Vodič'
}

export default function GuidesScreen({ navigation }: Props) {
  const guidesQuery = useQuery({
    queryKey: ['guides'],
    queryFn: () => listGuidesCatalog(client, { limit: 50 }),
  })

  if (guidesQuery.isLoading) {
    return (
      <View style={styles.root}>
        <Loader />
      </View>
    )
  }

  if (guidesQuery.isError) {
    return (
      <View style={styles.root}>
        <ErrorView message="Vodiči nisu učitani." onRetry={() => guidesQuery.refetch()} />
      </View>
    )
  }

  const items = guidesQuery.data ?? []

  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(item, i) => String(item.id ?? item.user?.username ?? i)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={guidesQuery.isRefetching} onRefresh={() => guidesQuery.refetch()} />}
        ListEmptyComponent={<EmptyState title="Nema vodiča" />}
        renderItem={({ item }) => {
          const name = guideName(item)
          const username = item.user?.username
          return (
            <Pressable
              onPress={() => {
                if (username || item.user?.id) {
                  navigation.navigate('UserProfile', {
                    username,
                    id: item.user?.id,
                  })
                }
              }}
            >
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Avatar uri={item.user?.avatarUrl} name={name} size={48} />
                  <View style={styles.info}>
                    <Text variant="label">{name}</Text>
                    {username ? (
                      <Text variant="small" color={colors.textMuted}>
                        @{username}
                      </Text>
                    ) : null}
                    <Text variant="small" color={colors.textMuted}>
                      {[item.grad, item.region].filter(Boolean).join(' · ')}
                      {item.prosecnaOcena != null && item.prosecnaOcena > 0
                        ? ` · ★ ${item.prosecnaOcena.toFixed(1)}`
                        : ''}
                    </Text>
                    {item.opis ? (
                      <Text variant="small" color={colors.textMuted} numberOfLines={2}>
                        {item.opis}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Card>
            </Pressable>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  info: { flex: 1, gap: 2 },
})
