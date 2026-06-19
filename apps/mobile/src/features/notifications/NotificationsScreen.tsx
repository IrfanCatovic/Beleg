import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
import {
  acceptFollowRequest,
  fetchFollowRequestsPending,
  fetchObavestenja,
  fetchParticipationRequests,
  markAllObavestenjaRead,
  markObavestenjeRead,
  rejectFollowRequest,
  respondParticipationRequest,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useModal } from '../../context/ModalContext'
import { Button, Card, EmptyState, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { HomeStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<HomeStackParamList, 'NotificationsList'>

export default function NotificationsScreen({ navigation }: Props) {
  const queryClient = useQueryClient()
  const { showAlert } = useModal()

  const listQuery = useQuery({
    queryKey: ['obavestenja'],
    queryFn: () => fetchObavestenja(client),
  })

  const followReqQuery = useQuery({
    queryKey: ['follow-requests', 'pending'],
    queryFn: () => fetchFollowRequestsPending(client),
  })

  const partReqQuery = useQuery({
    queryKey: ['participation-requests', 'pending'],
    queryFn: () => fetchParticipationRequests(client, 'pending'),
  })

  const markAllMutation = useMutation({
    mutationFn: () => markAllObavestenjaRead(client),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['obavestenja'] }),
  })

  const respondFollow = useMutation({
    mutationFn: async ({ followId, accept }: { followId: number; accept: boolean }) => {
      if (accept) await acceptFollowRequest(client, followId)
      else await rejectFollowRequest(client, followId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['follow-requests'] })
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Odgovor nije sačuvan.')),
  })

  const respondPart = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'accept' | 'reject' }) =>
      respondParticipationRequest(client, id, decision),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['participation-requests'] })
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Odgovor nije sačuvan.')),
  })

  const refreshAll = () => {
    void listQuery.refetch()
    void followReqQuery.refetch()
    void partReqQuery.refetch()
  }

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
        <ErrorView message="Obaveštenja nisu učitana." onRetry={refreshAll} />
      </Screen>
    )
  }

  const items = listQuery.data ?? []
  const followReqs = followReqQuery.data ?? []
  const partReqs = partReqQuery.data ?? []
  const hasPending = followReqs.length > 0 || partReqs.length > 0

  return (
    <Screen padded={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={listQuery.isRefetching || followReqQuery.isRefetching || partReqQuery.isRefetching}
            onRefresh={refreshAll}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {hasPending ? (
              <Card style={[styles.requestsCard, styles.requestsPending]}>
                <Text variant="label">Trenutni zahtevi</Text>
                {followReqs.map((r) => (
                  <View key={`f-${r.followId}`} style={styles.reqRow}>
                    <Text variant="small" style={styles.reqText}>
                      {r.requester.fullName || r.requester.username} želi da vas prati
                    </Text>
                    <View style={styles.reqActions}>
                      <Button
                        title="Prihvati"
                        onPress={() => respondFollow.mutate({ followId: r.followId, accept: true })}
                      />
                      <Button
                        title="Odbij"
                        variant="secondary"
                        onPress={() => respondFollow.mutate({ followId: r.followId, accept: false })}
                      />
                    </View>
                  </View>
                ))}
                {partReqs.map((r) => (
                  <View key={`p-${r.id}`} style={styles.reqRow}>
                    <Text variant="small" style={styles.reqText}>
                      {r.requestedBy.fullName || r.requestedBy.username} — {r.action.naziv}
                    </Text>
                    <View style={styles.reqActions}>
                      <Button
                        title="Prihvati"
                        onPress={() => respondPart.mutate({ id: r.id, decision: 'accept' })}
                      />
                      <Button
                        title="Odbij"
                        variant="secondary"
                        onPress={() => respondPart.mutate({ id: r.id, decision: 'reject' })}
                      />
                    </View>
                  </View>
                ))}
              </Card>
            ) : (
              <Card style={styles.requestsCard}>
                <Text variant="small" color={colors.textMuted}>
                  Nemate aktivnih zahteva
                </Text>
              </Card>
            )}

            {items.some((n) => !n.readAt) ? (
              <Pressable style={styles.markAll} onPress={() => markAllMutation.mutate()}>
                <Text color={colors.brand}>Označi sve kao pročitano</Text>
              </Pressable>
            ) : null}
          </View>
        }
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
  header: { gap: spacing.sm },
  requestsCard: { marginBottom: spacing.md, gap: spacing.sm },
  requestsPending: { borderLeftWidth: 3, borderLeftColor: colors.warning },
  reqRow: { gap: spacing.xs },
  reqText: { flex: 1 },
  reqActions: { flexDirection: 'row', gap: spacing.sm },
  markAll: { alignItems: 'flex-end', marginBottom: spacing.sm },
  list: { padding: spacing.lg },
  item: { marginBottom: spacing.sm },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.brand },
})
