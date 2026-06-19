import { FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { fetchPublicFerratas } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Card, EmptyState, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ExploreStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ExploreStackParamList, 'FerrataList'>

export default function FerrataListScreen({ navigation }: Props) {
  const ferratasQuery = useQuery({
    queryKey: ['ferratas'],
    queryFn: () => fetchPublicFerratas(client),
  })

  if (ferratasQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (ferratasQuery.isError) {
    return (
      <Screen>
        <ErrorView message="Ferrate nisu učitane." onRetry={() => ferratasQuery.refetch()} />
      </Screen>
    )
  }

  const items = ferratasQuery.data ?? []

  return (
    <Screen padded={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={ferratasQuery.isRefetching} onRefresh={() => ferratasQuery.refetch()} />}
        ListEmptyComponent={<EmptyState title="Nema ferrata" />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              if (item.slug) navigation.navigate('FerrataDetail', { slug: item.slug })
            }}
          >
            <Card style={styles.card}>
              <Text variant="label">{item.naziv}</Text>
              <Text variant="small" color={colors.textMuted}>
                {[item.lokacija, item.tezina].filter(Boolean).join(' · ')}
              </Text>
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
