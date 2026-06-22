import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { Task } from '@beleg/shared'
import { getApiErrorMessage } from '@beleg/shared'
import { fetchZadaci } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useSuperadminClub } from '../../hooks/useSuperadminClub'
import { TaskCard } from '../../components/tasks/TaskCard'
import { TaskFormModal } from '../../components/tasks/TaskFormModal'
import { Button, EmptyState, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { canManageTasks, canSeeTask } from '../../utils/taskPermissions'
import { colors, spacing } from '../../theme'
import { useTaskActions } from './useTaskActions'
import type { ClubStackParamList, ProfileStackParamList } from '../../navigation/types'

type Props =
  | NativeStackScreenProps<ClubStackParamList, 'Tasks'>
  | NativeStackScreenProps<ProfileStackParamList, 'Tasks'>

const STATUS_LABELS: Record<string, string> = {
  aktivni: 'Aktivni zadaci',
  u_toku: 'Izvršavaju se',
  zavrsen: 'Završeni zadaci',
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

export default function TasksScreen({ navigation }: Props) {
  const { user } = useAuth()
  const { hasSelectedClub, loading: superadminClubLoading } = useSuperadminClub()
  const isSuperadminNoClub = user?.role === 'superadmin' && !hasSelectedClub

  const [createOpen, setCreateOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)

  const {
    handleTake,
    handleLeave,
    handleFinish,
    handleDelete,
    handleCreate,
    handleUpdate,
    isLoading,
    isFormSubmitting,
  } = useTaskActions()

  const canManage = canManageTasks(user?.role)

  useLayoutEffect(() => {
    if (!canManage) {
      navigation.setOptions({ headerRight: undefined })
      return
    }
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => setCreateOpen(true)} hitSlop={8} style={styles.headerBtn}>
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
        </Pressable>
      ),
    })
  }, [navigation, canManage])

  const tasksQuery = useQuery({
    queryKey: ['zadaci'],
    queryFn: () => fetchZadaci(client),
    enabled: !isSuperadminNoClub,
  })

  const grouped = useMemo(() => {
    const tasks = tasksQuery.data ?? []
    const visible = tasks.filter((t) => canSeeTask(t, user?.role))
    return {
      aktivni: sortTasks(visible.filter((t) => t.status === 'aktivni')),
      u_toku: sortTasks(visible.filter((t) => t.status === 'u_toku')),
      zavrsen: sortTasks(visible.filter((t) => t.status === 'zavrsen')),
    }
  }, [tasksQuery.data, user?.role])

  const goToClubPicker = useCallback(() => {
    navigation.getParent()?.navigate('ClubTab', { screen: 'ClubHome' })
  }, [navigation])

  if (isSuperadminNoClub) {
    return (
      <Screen edges={['left', 'right']}>
        <View style={styles.pickClub}>
          <Text variant="heading" style={styles.pickClubTitle}>
            Izaberite klub
          </Text>
          <Text color={colors.textMuted} style={styles.pickClubMessage}>
            Da biste videli zadatke kluba, prvo uđite u klub na tabu Moj klub.
          </Text>
          <Button title="Idi na Moj klub" onPress={goToClubPicker} fullWidth />
        </View>
      </Screen>
    )
  }

  if (tasksQuery.isLoading || superadminClubLoading) {
    return (
      <Screen edges={['left', 'right']}>
        <Loader />
      </Screen>
    )
  }

  if (tasksQuery.isError) {
    return (
      <Screen edges={['left', 'right']}>
        <ErrorView
          message={getApiErrorMessage(tasksQuery.error, 'Zadaci nisu učitani.')}
          onRetry={() => tasksQuery.refetch()}
        />
      </Screen>
    )
  }

  const total = grouped.aktivni.length + grouped.u_toku.length + grouped.zavrsen.length

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={tasksQuery.isRefetching} onRefresh={() => tasksQuery.refetch()} />
        }
      >
        {total === 0 ? <EmptyState title="Nema zadataka" message="Nema zadataka za prikaz." /> : null}

        {(['aktivni', 'u_toku', 'zavrsen'] as const).map((status) => {
          const section = grouped[status]
          if (section.length === 0) return null
          return (
            <View key={status} style={styles.section}>
              <Text variant="label" style={styles.sectionTitle}>
                {STATUS_LABELS[status]} ({section.length})
              </Text>
              {section.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  username={user?.username}
                  userRole={user?.role}
                  onTake={handleTake}
                  onLeave={handleLeave}
                  onFinish={handleFinish}
                  onEdit={setEditTask}
                  onDelete={handleDelete}
                  isLoading={isLoading}
                />
              ))}
            </View>
          )
        })}
      </ScrollView>

      <TaskFormModal
        mode="create"
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        submitting={isFormSubmitting}
      />

      <TaskFormModal
        mode="edit"
        visible={editTask != null}
        task={editTask}
        onClose={() => setEditTask(null)}
        onSubmit={handleUpdate}
        submitting={isFormSubmitting}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  headerBtn: { marginRight: spacing.sm, padding: spacing.xs },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  section: { marginBottom: spacing.lg, gap: spacing.sm },
  sectionTitle: { marginBottom: spacing.xs },
  pickClub: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  pickClubTitle: { textAlign: 'center' },
  pickClubMessage: { textAlign: 'center' },
})
