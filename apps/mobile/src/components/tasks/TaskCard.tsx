import { StyleSheet, View } from 'react-native'
import type { Task } from '@beleg/shared'
import { Badge, Button, Card, Text } from '../ui'
import { colors, spacing } from '../../theme'
import {
  canManageTasks,
  canTakeTask,
  hasTakenTask,
} from '../../utils/taskPermissions'
import type { TaskActionKind } from '../../features/tasks/types'

interface TaskCardProps {
  task: Task
  username?: string
  userRole?: string
  onTake: (task: Task) => void
  onLeave: (task: Task) => void
  onFinish: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  isLoading?: (taskId: number, action: TaskActionKind) => boolean
}

export function TaskCard({
  task,
  username,
  userRole,
  onTake,
  onLeave,
  onFinish,
  onEdit,
  onDelete,
  isLoading,
}: TaskCardProps) {
  const isManager = canManageTasks(userRole)
  const canTake = canTakeTask(task, userRole)
  const taken = hasTakenTask(task, username)

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="label" style={styles.title}>
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

      <TaskCardFooter
        task={task}
        canTake={canTake}
        taken={taken}
        isManager={isManager}
        onTake={onTake}
        onLeave={onLeave}
        onFinish={onFinish}
        onEdit={onEdit}
        onDelete={onDelete}
        isLoading={isLoading}
      />
    </Card>
  )
}

function TaskCardFooter({
  task,
  canTake,
  taken,
  isManager,
  onTake,
  onLeave,
  onFinish,
  onEdit,
  onDelete,
  isLoading,
}: {
  task: Task
  canTake: boolean
  taken: boolean
  isManager: boolean
  onTake: (task: Task) => void
  onLeave: (task: Task) => void
  onFinish: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  isLoading?: (taskId: number, action: TaskActionKind) => boolean
}) {
  const loading = (action: TaskActionKind) => isLoading?.(task.id, action) ?? false

  if (task.status === 'aktivni') {
    if (taken) {
      return (
        <Button
          title="Otkaži prijavu"
          variant="ghost"
          onPress={() => onLeave(task)}
          loading={loading('leave')}
          fullWidth
        />
      )
    }
    if (canTake) {
      return (
        <Button
          title="Preuzmi zadatak"
          onPress={() => onTake(task)}
          loading={loading('take')}
          fullWidth
        />
      )
    }
    return (
      <View style={styles.noPermission}>
        <Text variant="small" color={colors.textMuted}>
          Nemaš dozvolu za ovaj zadatak
        </Text>
      </View>
    )
  }

  if (task.status === 'u_toku') {
    return (
      <View style={styles.footerRow}>
        {!taken && canTake ? (
          <View style={styles.footerBtn}>
            <Button
              title="Pridruži se"
              onPress={() => onTake(task)}
              loading={loading('take')}
              fullWidth
            />
          </View>
        ) : null}
        {taken ? (
          <View style={styles.footerBtn}>
            <Button
              title="Otkaži prijavu"
              variant="ghost"
              onPress={() => onLeave(task)}
              loading={loading('leave')}
              fullWidth
            />
          </View>
        ) : null}
        {isManager ? (
          <>
            <View style={styles.footerBtn}>
              <Button title="Izmeni" variant="secondary" onPress={() => onEdit(task)} fullWidth />
            </View>
            <View style={styles.footerBtn}>
              <Button
                title="Završi"
                variant="secondary"
                onPress={() => onFinish(task)}
                loading={loading('finish')}
                fullWidth
              />
            </View>
          </>
        ) : null}
      </View>
    )
  }

  if (isManager) {
    return (
      <Button
        title="Obriši zadatak"
        variant="danger"
        onPress={() => onDelete(task)}
        loading={loading('delete')}
        fullWidth
      />
    )
  }

  return (
    <View style={styles.noPermission}>
      <Text variant="small" color={colors.textMuted}>
        Završeno
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1 },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  footerBtn: { flexGrow: 1, minWidth: '45%' },
  noPermission: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    marginTop: spacing.xs,
  },
})
