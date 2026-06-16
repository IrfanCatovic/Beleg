/** Zadatak — usklađeno sa backend/internal/models/zadatak.go */

export type ZadatakRole = 'admin' | 'clan' | 'vodic' | 'blagajnik' | 'sekretar' | 'menadzer-opreme'

export interface TaskAssignee {
  username: string
  fullName?: string
  role: ZadatakRole | string
}

export interface Task {
  id: number
  naziv: string
  opis: string
  allowedRoles: ZadatakRole[]
  allowAll: boolean
  deadline: string | null
  hitno: boolean
  status: 'aktivni' | 'u_toku' | 'zavrsen'
  createdAt: string
  assignees?: TaskAssignee[]
}

export interface TaskFormData {
  naziv: string
  opis: string
  deadline: string | null
  hitno: boolean
  allowedRoles: ZadatakRole[]
  allowAll: boolean
}
