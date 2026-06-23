import type { AxiosInstance } from 'axios'
import type { GuideTourTypeKey } from '../constants/guideTourTypes'

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

export async function getMyGuideProfile(client: AxiosInstance): Promise<GuideProfile | null> {
  const res = await client.get<{ guideProfile: GuideProfile | null }>('/api/me/guide-profile')
  return res.data?.guideProfile ?? null
}

export async function applyGuideProfile(
  client: AxiosInstance,
  payload: GuideApplyPayload,
): Promise<GuideProfile> {
  const res = await client.post<{ guideProfile: GuideProfile }>('/api/guide-profiles/apply', payload)
  return res.data.guideProfile
}

export async function updateMyGuideProfile(
  client: AxiosInstance,
  payload: GuideApplyPayload,
): Promise<GuideProfile> {
  const res = await client.put<{ guideProfile: GuideProfile }>('/api/me/guide-profile', payload)
  return res.data.guideProfile
}
