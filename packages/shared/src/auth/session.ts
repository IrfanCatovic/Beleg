import type { AxiosInstance } from 'axios'

export type UserRole =
  | ''
  | 'superadmin'
  | 'admin'
  | 'clan'
  | 'vodic'
  | 'blagajnik'
  | 'sekretar'
  | 'menadzer-opreme'

export interface SessionUser {
  username: string
  fullName: string
  role: UserRole
  ukupnoKm?: number
  ukupnoMetaraUspona?: number
  brojPopeoSe?: number
  avatarUrl?: string
  klubId?: number
  profileIncomplete?: boolean
}

export interface MeResponse {
  username: string
  fullName: string
  role: string
  avatar_url?: string
  klubId?: number
  email?: string
  email_verified_at?: string | null
  pol?: string
  datum_rodjenja?: string | null
}

export interface LoginResponse {
  role: string
  user: { username: string; fullName: string; avatar_url?: string; klubId?: number }
  profileIncomplete?: boolean
  pendingSummitReward?: {
    notificationId: number
    actionId?: number
    actionName?: string
    link?: string
  }
  token?: string
}

export function computeProfileIncomplete(data: {
  email?: string
  email_verified_at?: string | null
  pol?: string
  datum_rodjenja?: string | null
}): boolean {
  const hasEmail = typeof data.email === 'string' && data.email.trim().length > 0
  const emailVerified = !!data.email_verified_at
  const hasGender = typeof data.pol === 'string' && data.pol.trim().length > 0
  const hasBirthDate = !!data.datum_rodjenja
  return !(hasEmail && emailVerified && hasGender && hasBirthDate)
}

export function meResponseToSessionUser(data: MeResponse): SessionUser {
  return {
    username: data.username,
    fullName: data.fullName ?? '',
    role: data.role as SessionUser['role'],
    avatarUrl: data.avatar_url,
    klubId: data.klubId,
    profileIncomplete: computeProfileIncomplete(data),
  }
}

export async function fetchMe(client: AxiosInstance): Promise<MeResponse | null> {
  const res = await client.get<MeResponse>('/api/me', {
    validateStatus: (s) => s === 200 || s === 401,
  })
  if (res.status === 401) return null
  return res.data
}

export async function logoutApi(client: AxiosInstance): Promise<void> {
  try {
    await client.post('/api/logout')
  } catch {
    // ignore
  }
}
