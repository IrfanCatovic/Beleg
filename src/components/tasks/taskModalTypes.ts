import type { TaskFormData } from '../../types/zadatak'

export type { ZadatakRole as Role, TaskFormData } from '../../types/zadatak'

export interface TaskForEdit extends TaskFormData {
  id: number
}
