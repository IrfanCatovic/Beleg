import TaskFormModal from './tasks/TaskFormModal'
import type { ZadatakRole, TaskFormData } from '../types/zadatak'

export type Role = ZadatakRole

interface NewTaskModalProps {
  open: boolean
  onClose: () => void
  onCreate: (data: TaskFormData) => Promise<void>
}

export default function NewTaskModal({ open, onClose, onCreate }: NewTaskModalProps) {
  return <TaskFormModal mode="create" open={open} onClose={onClose} onSubmit={onCreate} />
}
