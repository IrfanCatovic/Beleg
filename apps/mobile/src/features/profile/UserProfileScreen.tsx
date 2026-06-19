import { StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  fetchFollowCounts,
  fetchKorisnikByIdOrUsername,
  fetchKorisnikPopeoSe,
  fetchKorisnikStatistika,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Avatar, Button, Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ProfileStackParamList } from '../../navigation/types'
import type { HomeStackParamList } from '../../navigation/types'
import type { ActionsStackParamList } from '../../navigation/types'
import type { NotificationsStackParamList } from '../../navigation/types'

type Props =
  | NativeStackScreenProps<ProfileStackParamList, 'UserProfile'>
  | NativeStackScreenProps<HomeStackParamList, 'UserProfile'>
  | NativeStackScreenProps<ActionsStackParamList, 'UserProfile'>
  | NativeStackScreenProps<NotificationsStackParamList, 'UserProfile'>

export default function UserProfileScreen({ route, navigation }: Props) {
  const { user: me } = useAuth()
  const idOrUsername = route.params.username || String(route.params.id ?? '')

  const profileQuery = useQuery({
    queryKey: ['korisnik', idOrUsername],
    queryFn: () => fetchKorisnikByIdOrUsername(client, idOrUsername),
    enabled: !!idOrUsername,
  })

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

  const followQuery = useQuery({
    queryKey: ['follows', profileQuery.data?.id, 'counts'],
    queryFn: () => fetchFollowCounts(client, profileQuery.data!.id),
    enabled: !!profileQuery.data?.id,
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

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Avatar uri={korisnik.avatar_url} name={korisnik.fullName || korisnik.username} size={72} />
        <View style={styles.headerText}>
          <Text variant="title">{korisnik.fullName || korisnik.username}</Text>
          <Text color={colors.textMuted}>@{korisnik.username}</Text>
        </View>
      </View>

      {isMe ? (
        <Text variant="small" color={colors.textMuted}>
          Podešavanja naloga nalaze se u tabu Profil.
        </Text>
      ) : null}

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
        {(popeoQuery.data ?? []).slice(0, 5).map((a) => (
          <Text key={a.id} color={colors.textMuted}>
            · {a.naziv}
          </Text>
        ))}
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  headerText: { flex: 1, justifyContent: 'center' },
  stats: { marginTop: spacing.md, gap: spacing.xs },
})
