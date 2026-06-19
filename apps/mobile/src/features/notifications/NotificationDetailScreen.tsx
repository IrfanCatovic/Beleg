import { StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { fetchObavestenjeById } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Button, Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { spacing } from '../../theme'
import type { NotificationsStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<NotificationsStackParamList, 'NotificationDetail'>

interface ParsedMeta {
  akcijaId?: number
  actionId?: number
  userId?: number
  username?: string
  zadatakId?: number
}

function parseMetadata(metadata?: string): ParsedMeta {
  if (!metadata) return {}
  try {
    return JSON.parse(metadata) as ParsedMeta
  } catch {
    return {}
  }
}

export default function NotificationDetailScreen({ route, navigation }: Props) {
  const { id } = route.params

  const detailQuery = useQuery({
    queryKey: ['obavestenje', id],
    queryFn: () => fetchObavestenjeById(client, id),
  })

  if (detailQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <Screen>
        <ErrorView message="Obaveštenje nije učitano." onRetry={() => detailQuery.refetch()} />
      </Screen>
    )
  }

  const item = detailQuery.data
  const meta = parseMetadata(item.metadata)
  const actionId = meta.akcijaId ?? meta.actionId
  const userTarget = meta.username || (meta.userId ? String(meta.userId) : undefined)

  return (
    <Screen scroll>
      <Text variant="title" style={styles.title}>
        {item.title}
      </Text>
      <Text style={styles.body}>{item.body}</Text>
      <Text variant="small" style={styles.date}>
        {new Date(item.createdAt).toLocaleString('sr-RS')}
      </Text>

      <View style={styles.links}>
        {actionId ? (
          <Card style={styles.card}>
            <Text variant="label">Povezana akcija</Text>
            <Button
              title="Otvori akciju"
              variant="secondary"
              onPress={() => navigation.navigate('ActionDetail', { id: actionId })}
            />
          </Card>
        ) : null}

        {userTarget ? (
          <Card style={styles.card}>
            <Text variant="label">Korisnik</Text>
            <Button
              title="Otvori profil"
              variant="secondary"
              onPress={() =>
                navigation.navigate('UserProfile', {
                  username: meta.username,
                  id: meta.userId,
                })
              }
            />
          </Card>
        ) : null}

        {item.link ? (
          <Card style={styles.card}>
            <Text variant="label">Link</Text>
            <Text variant="small">{item.link}</Text>
          </Card>
        ) : null}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.md },
  body: { marginBottom: spacing.sm },
  date: { marginBottom: spacing.lg },
  links: { gap: spacing.md },
  card: { gap: spacing.sm },
})
