import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pressable, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
import {
  acceptFollowRequest,
  blockUser,
  cancelFollowRequest,
  fetchBlockStatus,
  fetchFollowCounts,
  fetchFollowStatus,
  fetchKorisnikByIdOrUsername,
  fetchKorisnikPopeoSe,
  fetchKorisnikStatistika,
  fetchKorisnikVodio,
  sendFollowRequest,
  unfollowUser,
  unblockUser,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Avatar, Button, Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ProfileStackParamList } from '../../navigation/types'
import type { HomeStackParamList } from '../../navigation/types'
import type { ActionsStackParamList } from '../../navigation/types'
import type { ExploreStackParamList } from '../../navigation/types'

type Props =
  | NativeStackScreenProps<ProfileStackParamList, 'UserProfile'>
  | NativeStackScreenProps<HomeStackParamList, 'UserProfile'>
  | NativeStackScreenProps<ActionsStackParamList, 'UserProfile'>
  | NativeStackScreenProps<ExploreStackParamList, 'UserProfile'>

export default function UserProfileScreen({ route, navigation }: Props) {
  const { user: me } = useAuth()
  const { showConfirm, showAlert } = useModal()
  const queryClient = useQueryClient()
  const idOrUsername = route.params.username || String(route.params.id ?? '')

  const profileQuery = useQuery({
    queryKey: ['korisnik', idOrUsername],
    queryFn: () => fetchKorisnikByIdOrUsername(client, idOrUsername),
    enabled: !!idOrUsername,
  })

  const targetId = profileQuery.data?.id

  const statsQuery = useQuery({
    queryKey: ['korisnik', idOrUsername, 'statistika'],
    queryFn: () => fetchKorisnikStatistika(client, idOrUsername),
    enabled: !!idOrUsername,
  })

  const popeoQuery = useQuery({
    queryKey: ['korisnik', idOrUsername, 'popeo-se'],
    queryFn: () => fetchKorisnikPopeoSe(client, idOrUsername),
    enabled: !!idOrUsername,
  })

  const vodioQuery = useQuery({
    queryKey: ['korisnik', idOrUsername, 'vodio'],
    queryFn: () => fetchKorisnikVodio(client, idOrUsername),
    enabled: !!idOrUsername,
  })

  const followQuery = useQuery({
    queryKey: ['follows', targetId, 'counts'],
    queryFn: () => fetchFollowCounts(client, targetId!),
    enabled: !!targetId,
  })

  const followStatusQuery = useQuery({
    queryKey: ['follows', targetId, 'status'],
    queryFn: () => fetchFollowStatus(client, targetId!),
    enabled: !!targetId && me?.username !== profileQuery.data?.username,
  })

  const blockStatusQuery = useQuery({
    queryKey: ['blocks', targetId, 'status'],
    queryFn: () => fetchBlockStatus(client, targetId!),
    enabled: !!targetId && me?.username !== profileQuery.data?.username,
  })

  const invalidateSocial = () => {
    void queryClient.invalidateQueries({ queryKey: ['follows', targetId] })
    void queryClient.invalidateQueries({ queryKey: ['blocks', targetId] })
  }

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!targetId) return
      const status = followStatusQuery.data
      if (status?.outgoing === 'accepted') {
        await unfollowUser(client, targetId)
      } else if (status?.outgoing === 'pending') {
        await cancelFollowRequest(client, targetId)
      } else if (status?.incoming === 'pending' && status.incomingFollowId) {
        await acceptFollowRequest(client, status.incomingFollowId)
      } else {
        await sendFollowRequest(client, targetId)
      }
    },
    onSuccess: invalidateSocial,
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Akcija nije uspela.')),
  })

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!targetId) return
      if (blockStatusQuery.data?.blockedByMe) {
        await unblockUser(client, targetId)
      } else {
        await blockUser(client, targetId)
      }
    },
    onSuccess: invalidateSocial,
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Blokiranje nije uspelo.')),
  })

  if (profileQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <Screen>
        <ErrorView message="Profil nije učitan." onRetry={() => profileQuery.refetch()} />
      </Screen>
    )
  }

  const korisnik = profileQuery.data
  const isMe = me?.username === korisnik.username
  const followStatus = followStatusQuery.data
  const blockedByTarget = blockStatusQuery.data?.blockedByTarget

  let followLabel = 'Zaprati'
  if (followStatus?.outgoing === 'accepted') followLabel = 'Otprati'
  else if (followStatus?.outgoing === 'pending') followLabel = 'Otkaži zahtev'
  else if (followStatus?.incoming === 'pending') followLabel = 'Prihvati zahtev'

  const goAction = (actionId: number) => {
    navigation.getParent()?.navigate('ActionsTab', {
      screen: 'ActionDetail',
      params: { id: actionId },
    })
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Avatar uri={korisnik.avatar_url} name={korisnik.fullName || korisnik.username} size={72} />
        <View style={styles.headerText}>
          <Text variant="title">{korisnik.fullName || korisnik.username}</Text>
          <Text color={colors.textMuted}>@{korisnik.username}</Text>
        </View>
      </View>

      {!isMe && !blockedByTarget ? (
        <View style={styles.socialRow}>
          <Button
            title={followLabel}
            onPress={() => followMutation.mutate()}
            loading={followMutation.isPending}
            fullWidth
          />
          <Button
            title={blockStatusQuery.data?.blockedByMe ? 'Odblokiraj' : 'Blokiraj'}
            variant="secondary"
            onPress={async () => {
              if (!blockStatusQuery.data?.blockedByMe) {
                const ok = await showConfirm('Blokiraj korisnika', 'Da li ste sigurni?')
                if (!ok) return
              }
              blockMutation.mutate()
            }}
            loading={blockMutation.isPending}
            fullWidth
          />
        </View>
      ) : null}

      {blockedByTarget ? (
        <Card>
          <Text color={colors.textMuted}>Ovaj korisnik vas je blokirao.</Text>
        </Card>
      ) : (
        <>
          <Card style={styles.stats}>
            <Text variant="label">Statistika</Text>
            <Text>Km: {statsQuery.data?.ukupnoKm ?? 0}</Text>
            <Text>Uspon: {statsQuery.data?.ukupnoMetaraUspona ?? 0} m</Text>
            <Text>Popeo se: {statsQuery.data?.brojPopeoSe ?? 0}</Text>
            <Text>
              Pratioci: {followQuery.data?.followers ?? 0} · Prati: {followQuery.data?.following ?? 0}
            </Text>
          </Card>

          <Card style={styles.stats}>
            <Text variant="label">Popeo se ({popeoQuery.data?.length ?? 0})</Text>
            {(popeoQuery.data ?? []).map((a) => (
              <Pressable key={a.id} onPress={() => goAction(a.id)}>
                <Text color={colors.brand}>· {a.naziv}</Text>
              </Pressable>
            ))}
          </Card>

          <Card style={styles.stats}>
            <Text variant="label">Vodio ({vodioQuery.data?.length ?? 0})</Text>
            {(vodioQuery.data ?? []).map((a) => (
              <Pressable key={a.id} onPress={() => goAction(a.id)}>
                <Text color={colors.brand}>· {a.naziv}</Text>
              </Pressable>
            ))}
          </Card>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  headerText: { flex: 1, justifyContent: 'center' },
  socialRow: { gap: spacing.sm, marginBottom: spacing.md },
  stats: { marginTop: spacing.md, gap: spacing.xs },
})
