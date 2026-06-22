import { useMemo } from 'react'
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
import { Avatar, Button, Card, EmptyState, ErrorView, Loader, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'

interface NoClubJoinViewProps {
  highlightClubId?: number | null
}

export default function NoClubJoinView({ highlightClubId }: NoClubJoinViewProps) {
  const { showAlert } = useModal()
  const queryClient = useQueryClient()

  const clubsQuery = useQuery({
    queryKey: ['klubovi', 'browse'],
    queryFn: () => searchKlubovi(client),
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
        Trenutno nisi član nijednog kluba. Koristi lupu gore desno da pronađeš klub, akciju ili korisnika.
      </Text>

      <FlatList
        data={clubs}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={false}
        ListEmptyComponent={<EmptyState title="Nema klubova" message="Pretraži klubove pomoću lupice." />}
        renderItem={({ item }: { item: KlubData }) => {
          const pending = pendingByClubId.get(item.id)
          const highlighted = highlightClubId === item.id
          return (
            <Card style={highlighted ? [styles.card, styles.cardHighlight] : styles.card}>
              <View style={styles.clubRow}>
                <Avatar uri={item.logoUrl} name={item.naziv} size={48} />
                <View style={styles.clubText}>
                  <Text variant="label">{item.naziv}</Text>
                  {item.sediste ? (
                    <Text variant="small" color={colors.textMuted}>
                      {item.sediste}
                    </Text>
                  ) : null}
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
  card: { marginBottom: spacing.sm, gap: spacing.sm },
  cardHighlight: { borderColor: colors.brand, borderWidth: 2 },
  clubRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  clubText: { flex: 1 },
})
