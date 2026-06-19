import { StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { fetchObavestenjeById } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Button, Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { spacing } from '../../theme'
import type { NotificationsStackParamList } from '../../navigation/types'

function tryParseActionId(metadata: string): number | undefined {
  try {
    const parsed = JSON.parse(metadata) as { akcijaId?: number; actionId?: number }
    return parsed.akcijaId ?? parsed.actionId
  } catch {
    return undefined
  }
}

type Props = NativeStackScreenProps<NotificationsStackParamList, 'NotificationDetail'>

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
  const actionId = (item.metadata && tryParseActionId(item.metadata)) || undefined

  return (
    <Screen scroll>
      <Text variant="title" style={styles.title}>
        {item.title}
      </Text>
      <Text style={styles.body}>{item.body}</Text>

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
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.md },
  body: { marginBottom: spacing.lg },
  card: { gap: spacing.sm },
})
