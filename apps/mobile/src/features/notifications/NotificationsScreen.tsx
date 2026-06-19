import { FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  fetchObavestenja,
  markAllObavestenjaRead,
  markObavestenjeRead,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { Card, EmptyState, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { NotificationsStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<NotificationsStackParamList, 'NotificationsList'>

export default function NotificationsScreen({ navigation }: Props) {
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: ['obavestenja'],
    queryFn: () => fetchObavestenja(client),
  })

  const markAllMutation = useMutation({
    mutationFn: () => markAllObavestenjaRead(client),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['obavestenja'] })
    },
  })

  if (listQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (listQuery.isError) {
    return (
      <Screen>
        <ErrorView message="Obaveštenja nisu učitana." onRetry={() => listQuery.refetch()} />
      </Screen>
    )
  }

  const items = listQuery.data ?? []

  return (
    <Screen padded={false}>
      {items.some((n) => !n.readAt) ? (
        <Pressable style={styles.markAll} onPress={() => markAllMutation.mutate()}>
          <Text color={colors.brand}>Označi sve kao pročitano</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={listQuery.isRefetching} onRefresh={() => listQuery.refetch()} />}
        ListEmptyComponent={<EmptyState title="Nema obaveštenja" />}
        renderItem={({ item }) => (
          <Pressable
            onPress={async () => {
              if (!item.readAt) {
                await markObavestenjeRead(client, item.id)
                void queryClient.invalidateQueries({ queryKey: ['obavestenja'] })
              }
              navigation.navigate('NotificationDetail', { id: item.id })
            }}
          >
            <Card style={item.readAt ? styles.item : [styles.item, styles.unread]}>
              <Text variant="label">{item.title}</Text>
              <Text variant="small" color={colors.textMuted} numberOfLines={2}>
                {item.body}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  markAll: { padding: spacing.lg, alignItems: 'flex-end' },
  list: { padding: spacing.lg },
  item: { marginBottom: spacing.sm },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.brand },
})
