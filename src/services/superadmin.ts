import api from './api'

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
  logo_url?: string
  valuta?: string
  createdAt?: string
}

export interface SuperadminKlubStats {
  totalUsers: number
  totalClubMembers: number
  totalActions: number
}

export interface NoClubUserRow {
  id: number
  username: string
  fullName?: string
  email?: string
  createdAt?: string
}

export interface SuperadminAppStatClub {
  klubId: number
  naziv: string
  memberCount: number
  actionCount: number
}

export async function fetchSuperadminAppStats() {
  const res = await api.get<{
    clubs: SuperadminAppStatClub[]
    totalUsers?: number
    totalClubMembers?: number
    totalMembers: number
    totalActions: number
  }>('/api/superadmin/app-stats')
  return res.data
}

export async function fetchSuperadminKlubovi() {
  const res = await api.get<{ klubovi: SuperadminKlub[] }>('/api/superadmin/klubovi')
  return res.data.klubovi ?? []
}

export async function fetchSuperadminUsersWithoutClub(q?: string) {
  const res = await api.get<{ korisnici: NoClubUserRow[] }>('/api/superadmin/korisnici/bez-kluba', {
    params: q ? { q } : {},
  })
  return res.data.korisnici ?? []
}

export async function deleteSuperadminKlub(id: number) {
  await api.delete(`/api/superadmin/klubovi/${id}`)
}

export async function deleteUserById(id: number) {
  await api.delete(`/api/korisnici/${id}`)
}

export async function createSuperadminKlub(payload: Record<string, unknown>) {
  const res = await api.post<{ klub: { id: number } }>('/api/superadmin/klubovi', payload)
  return res.data.klub
}

export async function updateSuperadminKlub(id: number, payload: Record<string, unknown>) {
  await api.patch(`/api/superadmin/klubovi/${id}`, payload)
}

export async function uploadSuperadminKlubLogo(id: number, formData: FormData) {
  await api.patch(`/api/superadmin/klubovi/${id}/logo`, formData)
}

export async function deleteSuperadminFerrata(id: number) {
  await api.delete(`/api/superadmin/ferratas/${id}`)
}
