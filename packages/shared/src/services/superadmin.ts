import type { AxiosInstance } from 'axios'

export interface SuperadminKlub {
  id: number
  naziv: string
  adresa?: string
  telefon?: string
  email?: string
  maticni_broj?: string
  pib?: string
  ziro_racun?: string
  sediste?: string
  web_sajt?: string
  datum_osnivanja?: string
  logo_url?: string
  logoUrl?: string
  valuta?: string
  korisnik_admin_limit?: number
  korisnik_limit?: number
  max_storage_gb?: number
  subscribedAt?: string | null
  subscriptionEndsAt?: string | null
  onHold?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface NoClubUserRow {
  id: number
  username: string
  fullName?: string
  email?: string
  avatar_url?: string
  createdAt?: string
}

export interface SuperadminAppStatClub {
  klubId: number
  naziv: string
  memberCount: number
  actionCount: number
}

export interface SuperadminAppStats {
  clubs: SuperadminAppStatClub[]
  totalUsers?: number
  totalClubMembers?: number
  totalMembers: number
  totalActions: number
}

export interface SuperadminKlubStats {
  totalUsers: number
  totalClubMembers: number
  totalActions: number
}

export async function fetchSuperadminAppStats(client: AxiosInstance): Promise<SuperadminAppStats> {
  const res = await client.get<SuperadminAppStats>('/api/superadmin/app-stats')
  return res.data
}

export async function fetchSuperadminKlubovi(client: AxiosInstance): Promise<SuperadminKlub[]> {
  const res = await client.get<{ klubovi: SuperadminKlub[] }>('/api/superadmin/klubovi')
  return res.data.klubovi ?? []
}

export async function fetchSuperadminUsersWithoutClub(
  client: AxiosInstance,
  q?: string,
): Promise<NoClubUserRow[]> {
  const res = await client.get<{ korisnici: NoClubUserRow[] }>('/api/superadmin/korisnici/bez-kluba', {
    params: q ? { q } : {},
  })
  return res.data.korisnici ?? []
}

export async function deleteSuperadminKlub(client: AxiosInstance, id: number): Promise<void> {
  await client.delete(`/api/superadmin/klubovi/${id}`)
}

export async function deleteUserById(client: AxiosInstance, id: number): Promise<void> {
  await client.delete(`/api/korisnici/${id}`)
}

export async function createSuperadminKlub(
  client: AxiosInstance,
  payload: Record<string, unknown>,
): Promise<{ id: number }> {
  const res = await client.post<{ klub: { id: number } }>('/api/superadmin/klubovi', payload)
  return res.data.klub
}

export async function updateSuperadminKlub(
  client: AxiosInstance,
  id: number,
  payload: Record<string, unknown>,
): Promise<void> {
  await client.patch(`/api/superadmin/klubovi/${id}`, payload)
}

export async function uploadSuperadminKlubLogo(
  client: AxiosInstance,
  id: number,
  formData: FormData,
): Promise<void> {
  await client.patch(`/api/superadmin/klubovi/${id}/logo`, formData)
}
