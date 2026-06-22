import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { Task } from '@beleg/shared'
import { getApiErrorMessage } from '@beleg/shared'
import {
  fetchZadaci,
  napustiZadatak,
  preuzmiZadatak,
  zavrsiZadatak,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Badge, Button, Card, EmptyState, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ClubStackParamList, ProfileStackParamList } from '../../navigation/types'

type Props =
  | NativeStackScreenProps<ClubStackParamList, 'Tasks'>
  | NativeStackScreenProps<ProfileStackParamList, 'Tasks'>

const STATUS_LABELS: Record<string, string> = {
  aktivni: 'Aktivni',
  u_toku: 'U toku',
  zavrsen: 'Završeni',
}

function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    if (a.hitno !== b.hitno) return a.hitno ? -1 : 1
    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity
    const db = b.deadline ? new Date(b.deadline).getTime() : Infinity
    if (da !== db) return da - db
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export default function TasksScreen(_props: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { showAlert } = useModal()

  const tasksQuery = useQuery({
    queryKey: ['zadaci'],
    queryFn: () => fetchZadaci(client),
  })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['zadaci'] })

  const preuzmiMutation = useMutation({
    mutationFn: (id: number) => preuzmiZadatak(client, id),
    onSuccess: invalidate,
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Preuzimanje nije uspelo.')),
  })

  const zavrsiMutation = useMutation({
    mutationFn: (id: number) => zavrsiZadatak(client, id),
    onSuccess: invalidate,
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Završetak nije uspeo.')),
  })

  const napustiMutation = useMutation({
    mutationFn: (id: number) => napustiZadatak(client, id),
    onSuccess: invalidate,
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Napuštanje nije uspelo.')),
  })

  const grouped = useMemo(() => {
    const tasks = tasksQuery.data ?? []
    const visible = tasks.filter((t) => {
      if (user?.role === 'clan') return t.allowAll
      return true
    })
    return {
      aktivni: sortTasks(visible.filter((t) => t.status === 'aktivni')),
      u_toku: sortTasks(visible.filter((t) => t.status === 'u_toku')),
      zavrsen: sortTasks(visible.filter((t) => t.status === 'zavrsen')),
    }
  }, [tasksQuery.data, user?.role])

  const hasTaken = (task: Task) =>
    !!user && (task.assignees ?? []).some((a) => a.username === user.username)

  const canTake = (task: Task) => {
    if (!user) return false
    if (task.allowAll) return true
    return task.allowedRoles?.includes(user.role as Task['allowedRoles'][number])
  }

  if (tasksQuery.isLoading) {
    return (
      <Screen edges={['left', 'right']}>
        <Loader />
      </Screen>
    )
  }

  if (tasksQuery.isError) {
    return (
      <Screen edges={['left', 'right']}>
        <ErrorView message="Zadaci nisu učitani." onRetry={() => tasksQuery.refetch()} />
      </Screen>
    )
  }

  const total = grouped.aktivni.length + grouped.u_toku.length + grouped.zavrsen.length

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {total === 0 ? <EmptyState title="Nema zadataka" /> : null}

        {(['aktivni', 'u_toku', 'zavrsen'] as const).map((status) => {
          const section = grouped[status]
          if (section.length === 0) return null
          return (
            <View key={status} style={styles.section}>
              <Text variant="label" style={styles.sectionTitle}>
                {STATUS_LABELS[status]}
              </Text>
              {section.map((task) => {
                const taken = hasTaken(task)
                const takeAllowed = canTake(task)
                return (
                  <Card key={task.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text variant="label" style={styles.cardTitle}>
                        {task.naziv}
                      </Text>
                      {task.hitno ? <Badge label="Hitno" tone="danger" /> : null}
                    </View>
                    {task.opis ? (
                      <Text variant="small" color={colors.textMuted}>
                        {task.opis}
                      </Text>
                    ) : null}
                    {task.deadline ? (
                      <Text variant="small" color={colors.textMuted}>
                        Rok: {new Date(task.deadline).toLocaleDateString('sr-Latn-RS')}
                      </Text>
                    ) : null}
                    {(task.assignees ?? []).length > 0 ? (
                      <Text variant="small" color={colors.textMuted}>
                        Preuzeli: {task.assignees!.map((a) => a.fullName || a.username).join(', ')}
                      </Text>
                    ) : null}
                    <View style={styles.actions}>
                      {status === 'aktivni' && takeAllowed && !taken ? (
                        <Button
                          title="Preuzmi"
                          variant="secondary"
                          onPress={() => preuzmiMutation.mutate(task.id)}
                          loading={preuzmiMutation.isPending}
                        />
                      ) : null}
                      {status === 'u_toku' && taken ? (
                        <>
                          <Button
                            title="Završi"
                            onPress={() => zavrsiMutation.mutate(task.id)}
                            loading={zavrsiMutation.isPending}
                          />
                          <Button
                            title="Napusti"
                            variant="ghost"
                            onPress={() => napustiMutation.mutate(task.id)}
                            loading={napustiMutation.isPending}
                          />
                        </>
                      ) : null}
                    </View>
                  </Card>
                )
              })}
            </View>
          )
        })}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  section: { marginBottom: spacing.lg, gap: spacing.sm },
  sectionTitle: { marginBottom: spacing.xs },
  card: { gap: spacing.sm, marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
})
