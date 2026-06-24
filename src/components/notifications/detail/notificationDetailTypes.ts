import type { Role } from '../../NewTaskModal'
import type { Task } from '../../TaskCard'

export interface ObavestenjeFull {
  id: number
  userId: number
  type: string
  title: string
  body?: string
  link?: string
  metadata?: string
  readAt?: string | null
  createdAt: string
}

export interface ActionParticipationRequestPayload {
  id: number
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  createdAt: string
  updatedAt: string
  respondedAt?: string | null
  action: {
    id: number
    naziv: string
    datum: string
    planina?: string
    vrh?: string
    klubNaziv?: string
  }
  targetUser: {
    id: number
    username: string
    fullName?: string
    klubNaziv?: string
  }
  requestedBy: {
    id: number
    username: string
    fullName?: string
    klubNaziv?: string
  }
}

export interface TaskPayload {
  id: number
  naziv: string
  opis: string
  allowedRoles: string[]
  allowAll: boolean
  deadline: string | null
  hitno: boolean
  status: string
  createdAt: string
  assignees?: { username: string; fullName?: string; role: string }[]
}

export function normalizeApiTask(raw: TaskPayload): Task {
  const st = raw.status
  const status: Task['status'] =
    st === 'aktivni' || st === 'u_toku' || st === 'zavrsen' ? st : 'aktivni'
  return {
    id: raw.id,
    naziv: raw.naziv,
    opis: raw.opis ?? '',
    allowedRoles: (raw.allowedRoles || []) as Role[],
    allowAll: raw.allowAll,
    deadline: raw.deadline ?? null,
    hitno: raw.hitno,
    status,
    createdAt: raw.createdAt,
    assignees: raw.assignees,
  }
}

export interface TransPayload {
  id: number
  tip: string
  iznos: number
  opis?: string
  datum: string
  korisnikId: number
  korisnik?: { fullName?: string; username?: string }
  clanarinaKorisnik?: { fullName?: string; username?: string }
  createdAt?: string
}

export function transakcijaTipLabel(tip: string): string {
  if (tip === 'uplata') return 'uplata'
  if (tip === 'isplata') return 'isplata'
  return tip
}
