import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { getApiErrorMessage } from '@beleg/shared'
import {
  fetchClubJoinRequests,
  fetchObavestenjeById,
  markObavestenjeRead,
  respondClubJoinRequest,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Avatar, Button, Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { canManageClub } from '../../utils/roles'
import { colors, spacing } from '../../theme'
import type { HomeStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<HomeStackParamList, 'NotificationDetail'>

interface ParsedMeta {
  akcijaId?: number
  actionId?: number
  userId?: number
  username?: string
  zadatakId?: number
  clubJoinRequestId?: number
  requesterUsername?: string
  requesterFullName?: string
}

function parseMetadata(metadata?: string): ParsedMeta {
  if (!metadata) return {}
  try {
    return JSON.parse(metadata) as ParsedMeta
  } catch {
    return {}
  }
}

function friendlyLinkLabel(link?: string): string | null {
  if (!link) return null
  const path = link.replace(/^https?:\/\/[^/]+/i, '').split('?')[0]
  if (path === '/klub' || path.startsWith('/klub')) return 'Stranica kluba'
  if (path.startsWith('/akcije')) return 'Lista akcija'
  if (path.startsWith('/profil')) return 'Profil korisnika'
  if (path.startsWith('/zadaci')) return 'Zadaci kluba'
  if (path.startsWith('/finansije')) return 'Finansije kluba'
  return 'Otvori u aplikaciji'
}

export default function NotificationDetailScreen({ route, navigation }: Props) {
  const { id } = route.params
  const { user } = useAuth()
  const { showAlert, showConfirm } = useModal()
  const queryClient = useQueryClient()

  const detailQuery = useQuery({
    queryKey: ['obavestenje', id],
    queryFn: () => fetchObavestenjeById(client, id),
  })

  const meta = useMemo(() => parseMetadata(detailQuery.data?.metadata), [detailQuery.data?.metadata])
  const clubJoinRequestId = meta.clubJoinRequestId

  const joinRequestsQuery = useQuery({
    queryKey: ['klub', 'join-requests', 'notification'],
    queryFn: () => fetchClubJoinRequests(client, 'pending'),
    enabled: clubJoinRequestId != null && canManageClub(user, user?.klubId ?? undefined),
  })

  const joinRequest = useMemo(
    () => joinRequestsQuery.data?.find((r) => r.id === clubJoinRequestId),
    [joinRequestsQuery.data, clubJoinRequestId],
  )

  const respondMutation = useMutation({
    mutationFn: (action: 'accept' | 'reject' | 'block') =>
      respondClubJoinRequest(client, clubJoinRequestId!, action),
    onSuccess: async (_data, action) => {
      await markObavestenjeRead(client, id)
      void queryClient.invalidateQueries({ queryKey: ['obavestenja'] })
      void queryClient.invalidateQueries({ queryKey: ['klub', 'join-requests'] })
      const msg =
        action === 'accept'
          ? 'Korisnik je prihvaćen u klub.'
          : action === 'reject'
            ? 'Zahtev je odbijen.'
            : 'Korisnik je blokiran.'
      await showAlert('Gotovo', msg)
      navigation.goBack()
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Akcija nije uspela.')),
  })

  if (detailQuery.isLoading) {
    return (
      <Screen edges={['left', 'right']}>
        <Loader />
      </Screen>
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <Screen edges={['left', 'right']}>
        <ErrorView message="Obaveštenje nije učitano." onRetry={() => detailQuery.refetch()} />
      </Screen>
    )
  }

  const item = detailQuery.data
  const actionId = meta.akcijaId ?? meta.actionId
  const userTarget = meta.username || meta.requesterUsername || (meta.userId ? String(meta.userId) : undefined)
  const displayName =
    joinRequest?.fullName ||
    meta.requesterFullName ||
    joinRequest?.username ||
    meta.requesterUsername ||
    userTarget
  const linkLabel = friendlyLinkLabel(item.link)
  const canRespondJoin =
    !!joinRequest &&
    joinRequest.status === 'pending' &&
    canManageClub(user, user?.klubId ?? undefined)
  const joinHandled = clubJoinRequestId != null && !joinRequest && !joinRequestsQuery.isLoading

  return (
    <Screen scroll edges={['left', 'right']}>
      <Text variant="title" style={styles.title}>
        {item.title}
      </Text>
      <Text style={styles.body}>{item.body}</Text>
      <Text variant="small" style={styles.date}>
        {new Date(item.createdAt).toLocaleString('sr-RS')}
      </Text>

      {clubJoinRequestId ? (
        <Card style={styles.card}>
          <Text variant="label">Zahtev za članstvo</Text>
          {displayName ? (
            <View style={styles.userRow}>
              <Avatar uri={undefined} name={displayName} size={48} />
              <View style={styles.userInfo}>
                <Text variant="label">{displayName}</Text>
                {joinRequest?.username || meta.requesterUsername ? (
                  <Text variant="small" color={colors.textMuted}>
                    @{joinRequest?.username || meta.requesterUsername}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <Text color={colors.textMuted}>Korisnik je poslao zahtev za prijem u klub.</Text>
          )}

          {canRespondJoin ? (
            <View style={styles.joinActions}>
              <Button
                title="Prihvati u klub"
                onPress={async () => {
                  const ok = await showConfirm('Prihvati zahtev', `Prihvatiti ${displayName} u klub?`)
                  if (ok) respondMutation.mutate('accept')
                }}
                loading={respondMutation.isPending}
              />
              <Button
                title="Odbij"
                variant="secondary"
                onPress={async () => {
                  const ok = await showConfirm('Odbij zahtev', 'Odbiti zahtev za članstvo?')
                  if (ok) respondMutation.mutate('reject')
                }}
                loading={respondMutation.isPending}
              />
            </View>
          ) : null}

          {joinHandled ? (
            <Text variant="small" color={colors.textMuted}>
              Ovaj zahtev je već obrađen ili više nije aktivan.
            </Text>
          ) : null}
        </Card>
      ) : null}

      <View style={styles.links}>
        {actionId ? (
          <Card style={styles.card}>
            <View style={styles.linkRow}>
              <Ionicons name="trail-sign-outline" size={20} color={colors.brand} />
              <Text variant="label">Povezana akcija</Text>
            </View>
            <Button
              title="Pogledaj akciju"
              variant="secondary"
              onPress={() => navigation.navigate('ActionDetail', { id: actionId })}
            />
          </Card>
        ) : null}

        {userTarget && !clubJoinRequestId ? (
          <Card style={styles.card}>
            <View style={styles.linkRow}>
              <Ionicons name="person-outline" size={20} color={colors.brand} />
              <Text variant="label">Korisnik</Text>
            </View>
            <Button
              title="Otvori profil"
              variant="secondary"
              onPress={() =>
                navigation.navigate('UserProfile', {
                  username: meta.username || meta.requesterUsername,
                  id: meta.userId,
                })
              }
            />
          </Card>
        ) : null}

        {linkLabel && !clubJoinRequestId ? (
          <Card style={styles.card}>
            <View style={styles.linkRow}>
              <Ionicons name="open-outline" size={20} color={colors.brand} />
              <Text variant="label">{linkLabel}</Text>
            </View>
            <Text variant="small" color={colors.textMuted}>
              Otvori odgovarajući deo aplikacije iz donjeg menija.
            </Text>
          </Card>
        ) : null}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.md },
  body: { marginBottom: spacing.sm },
  date: { marginBottom: spacing.lg, color: colors.textMuted },
  links: { gap: spacing.md },
  card: { gap: spacing.sm },
  userRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  userInfo: { flex: 1, gap: 2 },
  joinActions: { gap: spacing.sm, marginTop: spacing.sm },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
})
