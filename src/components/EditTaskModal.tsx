import TaskFormModal from './tasks/TaskFormModal'
import type { Role, TaskFormData, TaskForEdit } from './tasks/taskModalTypes'

export type { Role, TaskForEdit }

interface EditTaskModalProps {
  open: boolean
  task: TaskForEdit | null
  onClose: () => void
  onSave: (taskId: number, data: TaskFormData) => Promise<void>
}

export default function EditTaskModal({ open, task, onClose, onSave }: EditTaskModalProps) {
  return <TaskFormModal mode="edit" open={open} task={task} onClose={onClose} onSubmit={onSave} />
}
