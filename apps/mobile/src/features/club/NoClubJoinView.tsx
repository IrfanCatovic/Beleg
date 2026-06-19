import { useCallback, useMemo, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage } from '@beleg/shared'
import {
  cancelJoinRequest,
  createJoinRequest,
  fetchMyJoinRequests,
  searchKlubovi,
} from '@beleg/shared/services'
import type { KlubData } from '@beleg/shared'
import { client } from '../../api/client'
import { useModal } from '../../context/ModalContext'
import { Avatar, Button, Card, EmptyState, ErrorView, Input, Loader, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'

export default function NoClubJoinView() {
  const { showAlert } = useModal()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const clubsQuery = useQuery({
    queryKey: ['klubovi', 'search', search],
    queryFn: () => searchKlubovi(client, search.trim() || undefined),
  })

  const requestsQuery = useQuery({
    queryKey: ['club-join-requests', 'mine'],
    queryFn: () => fetchMyJoinRequests(client),
  })

  const pendingByClubId = useMemo(() => {
    const map = new Map<number, { id: number }>()
    for (const req of requestsQuery.data?.requests ?? []) {
      if (req.status === 'pending') map.set(req.clubId, { id: req.id })
    }
    return map
  }, [requestsQuery.data])

  const joinMutation = useMutation({
    mutationFn: (clubId: number) => createJoinRequest(client, clubId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['club-join-requests'] })
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Zahtev nije poslat.')),
  })

  const cancelMutation = useMutation({
    mutationFn: (requestId: number) => cancelJoinRequest(client, requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['club-join-requests'] })
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Otkazivanje nije uspelo.')),
  })

  const onSearch = useCallback(() => {
    void clubsQuery.refetch()
  }, [clubsQuery])

  const clubs = clubsQuery.data?.klubovi ?? []

  if (clubsQuery.isLoading && requestsQuery.isLoading) {
    return <Loader />
  }

  if (clubsQuery.isError) {
    return <ErrorView message="Klubovi nisu učitani." onRetry={() => clubsQuery.refetch()} />
  }

  return (
    <View style={styles.wrap}>
      <Text variant="heading">Pridruži se klubu</Text>
      <Text variant="muted" style={styles.sub}>
        Trenutno nisi član nijednog kluba. Pretraži klubove i pošalji zahtev za prijem.
      </Text>

      <View style={styles.searchRow}>
        <Input
          placeholder="Pretraži klub po nazivu..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
        <Button title="Traži" variant="secondary" onPress={onSearch} />
      </View>

      <FlatList
        data={clubs}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<EmptyState title="Nema klubova" message="Pokušaj drugu pretragu." />}
        renderItem={({ item }: { item: KlubData }) => {
          const pending = pendingByClubId.get(item.id)
          return (
            <Card style={styles.card}>
              <View style={styles.clubRow}>
                <Avatar uri={item.logoUrl} name={item.naziv} size={48} />
                <View style={styles.clubText}>
                  <Text variant="label">{item.naziv}</Text>
                  {item.sediste ? <Text variant="small" color={colors.textMuted}>{item.sediste}</Text> : null}
                </View>
              </View>
              {pending ? (
                <Button
                  title="Povuci zahtev"
                  variant="secondary"
                  loading={cancelMutation.isPending}
                  onPress={() => cancelMutation.mutate(pending.id)}
                />
              ) : (
                <Button
                  title="Pošalji zahtev"
                  loading={joinMutation.isPending}
                  onPress={() => joinMutation.mutate(item.id)}
                />
              )}
            </Card>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md },
  sub: { marginBottom: spacing.sm },
  searchRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  searchInput: { flex: 1 },
  card: { marginBottom: spacing.sm, gap: spacing.sm },
  clubRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  clubText: { flex: 1 },
})
