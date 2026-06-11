import api from './api'
import type { GuideTourTypeKey } from '../i18n/guideProfiles'

export type GuideProfileStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

export type GuideProfileUser = {
  id: number
  username: string
  fullName: string
  email: string
  avatarUrl?: string
  telefon?: string
}

export type GuideProfile = {
  id: number
  korisnikId: number
  status: GuideProfileStatus
  naslov: string
  opis: string
  drzava?: string
  region?: string
  grad?: string
  baseLat?: number
  baseLng?: number
  jezici: string[]
  sertifikatiOpis?: string
  tourTypes: string[]
  prosecnaOcena?: number
  brojOcena?: number
  razlogOdbijanja?: string
  createdAt: string
  updatedAt: string
  user?: GuideProfileUser
}

export type GuideApplyPayload = {
  opis: string
  drzava?: string
  region?: string
  grad?: string
  baseLat: number
  baseLng: number
  jezici: string[]
  sertifikatiOpis?: string
  tourTypes: GuideTourTypeKey[]
  telefon?: string
}

export async function getMyGuideProfile(): Promise<GuideProfile | null> {
  const res = await api.get<{ guideProfile: GuideProfile | null }>('/api/me/guide-profile')
  return res.data?.guideProfile ?? null
}

export async function isApprovedProfiGuide(): Promise<boolean> {
  const gp = await getMyGuideProfile()
  return gp?.status === 'approved'
}

export async function applyGuideProfile(payload: GuideApplyPayload): Promise<GuideProfile> {
  const res = await api.post<{ guideProfile: GuideProfile }>('/api/guide-profiles/apply', payload)
  return res.data.guideProfile
}

export async function updateMyGuideProfile(payload: GuideApplyPayload): Promise<GuideProfile> {
  const res = await api.put<{ guideProfile: GuideProfile }>('/api/me/guide-profile', payload)
  return res.data.guideProfile
}

export async function listGuideProfilesAdmin(status?: string): Promise<GuideProfile[]> {
  const url = status ? `/api/superadmin/guide-profiles?status=${encodeURIComponent(status)}` : '/api/superadmin/guide-profiles'
  const res = await api.get<{ guideProfiles: GuideProfile[] }>(url)
  return res.data?.guideProfiles ?? []
}

export async function approveGuideProfile(id: number): Promise<GuideProfile> {
  const res = await api.put<{ guideProfile: GuideProfile }>(`/api/superadmin/guide-profiles/${id}/approve`)
  return res.data.guideProfile
}

export async function rejectGuideProfile(id: number, razlogOdbijanja: string): Promise<GuideProfile> {
  const res = await api.put<{ guideProfile: GuideProfile }>(`/api/superadmin/guide-profiles/${id}/reject`, {
    razlogOdbijanja,
  })
  return res.data.guideProfile
}

export async function suspendGuideProfile(id: number): Promise<GuideProfile> {
  const res = await api.put<{ guideProfile: GuideProfile }>(`/api/superadmin/guide-profiles/${id}/suspend`)
  return res.data.guideProfile
}
