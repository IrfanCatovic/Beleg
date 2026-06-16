export type Role = 'admin' | 'clan' | 'vodic' | 'blagajnik' | 'sekretar' | 'menadzer-opreme'

export interface TaskFormData {
  naziv: string
  opis: string
  deadline: string | null
  hitno: boolean
  allowedRoles: Role[]
  allowAll: boolean
}

export interface TaskForEdit extends TaskFormData {
  id: number
}
