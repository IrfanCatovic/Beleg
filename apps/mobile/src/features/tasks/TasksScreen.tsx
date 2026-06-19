import { FlatList, RefreshControl, StyleSheet } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { fetchZadaci, preuzmiZadatak, zavrsiZadatak } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Badge, Button, Card, EmptyState, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ProfileStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ProfileStackParamList, 'Tasks'>

export default function TasksScreen(_props: Props) {
  const queryClient = useQueryClient()

  const tasksQuery = useQuery({
    queryKey: ['zadaci'],
    queryFn: () => fetchZadaci(client),
  })

  const preuzmiMutation = useMutation({
    mutationFn: (id: number) => preuzmiZadatak(client, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zadaci'] }),
  })

  const zavrsiMutation = useMutation({
    mutationFn: (id: number) => zavrsiZadatak(client, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zadaci'] }),
  })

  if (tasksQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (tasksQuery.isError) {
    return (
      <Screen>
        <ErrorView message="Zadaci nisu učitani." onRetry={() => tasksQuery.refetch()} />
      </Screen>
    )
  }

  const tasks = tasksQuery.data ?? []

  return (
    <Screen padded={false}>
      <FlatList
        data={tasks}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={tasksQuery.isRefetching} onRefresh={() => tasksQuery.refetch()} />}
        ListEmptyComponent={<EmptyState title="Nema zadataka" />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text variant="label">{item.naziv}</Text>
            <Text variant="small" color={colors.textMuted}>
              {item.opis}
            </Text>
            <Badge label={item.status} tone="muted" />
            <Button
              title="Preuzmi"
              variant="secondary"
              onPress={() => preuzmiMutation.mutate(item.id)}
              loading={preuzmiMutation.isPending}
            />
            <Button
              title="Završi"
              onPress={() => zavrsiMutation.mutate(item.id)}
              loading={zavrsiMutation.isPending}
            />
          </Card>
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  card: { marginBottom: spacing.sm, gap: spacing.sm },
})
