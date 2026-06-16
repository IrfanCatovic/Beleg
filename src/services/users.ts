import api from './api'
import type { Korisnik } from '../types/korisnik'
import type { UspesnaAkcija, KorisnikStatistika } from '../types/uspesnaAkcija'
import type { AkcijaZaRanking } from '../utils/rankingUtils'

export async function fetchKorisnici(options?: { scope?: string }) {
  const res = await api.get<{ korisnici?: Korisnik[] }>('/api/korisnici', {
    params: options?.scope ? { scope: options.scope } : undefined,
  })
  return res.data.korisnici ?? []
}

export async function fetchKorisnikByIdOrUsername(idOrUsername: string) {
  const res = await api.get<Korisnik>(`/api/korisnici/${encodeURIComponent(idOrUsername)}`)
  return res.data
}

export async function fetchKorisnikStatistika(idOrUsername: string) {
  const res = await api.get<{ statistika?: KorisnikStatistika }>(
    `/api/korisnici/${encodeURIComponent(idOrUsername)}/statistika`,
  )
  const s: KorisnikStatistika = res.data.statistika ?? {
    ukupnoKm: 0,
    ukupnoMetaraUspona: 0,
    brojPopeoSe: 0,
  }
  return {
    ukupnoKm: s.ukupnoKm || 0,
    ukupnoMetaraUspona: s.ukupnoMetaraUspona || 0,
    brojPopeoSe: s.brojPopeoSe || 0,
  }
}

export async function fetchKorisnikPopeoSe(idOrUsername: string) {
  const res = await api.get<{ uspesneAkcije?: UspesnaAkcija[] }>(
    `/api/korisnici/${encodeURIComponent(idOrUsername)}/popeo-se`,
  )
  return res.data.uspesneAkcije ?? []
}

export async function fetchKorisnikPopeoSeById(userId: number) {
  const res = await api.get<{ uspesneAkcije?: AkcijaZaRanking[] }>(`/api/korisnici/${userId}/popeo-se`)
  return res.data.uspesneAkcije ?? []
}

export async function fetchKorisnikVodio(idOrUsername: string) {
  const res = await api.get<{ vodeneAkcije?: UspesnaAkcija[] }>(
    `/api/korisnici/${encodeURIComponent(idOrUsername)}/vodio`,
  )
  return res.data.vodeneAkcije ?? []
}

export async function fetchFollowCounts(userId: number) {
  const res = await api.get<{ following?: number; followers?: number }>(`/api/follows/user/${userId}/counts`)
  return { following: res.data.following ?? 0, followers: res.data.followers ?? 0 }
}

export async function updateMyCoverPosition(payload: { coverPositionY?: number; coverPositionYMobile?: number }) {
  await api.patch('/api/me/cover-position', payload)
}

export async function updateMyCover(formData: FormData) {
  const res = await api.patch<{ cover_image_url?: string }>('/api/me/cover', formData)
  return res.data
}

export async function updateMyAvatar(formData: FormData) {
  const res = await api.patch<{ avatar_url?: string }>('/api/me/avatar', formData)
  return res.data
}

export async function fetchKorisnikById(id: number) {
  const res = await api.get<Korisnik>(`/api/korisnici/${id}`)
  return res.data
}

export async function fetchKorisnikInfo(id: number) {
  const res = await api.get(`/api/korisnici/${id}/info`)
  return res.data
}

export async function patchKorisnik(id: number, body: Record<string, unknown>) {
  await api.patch(`/api/korisnici/${id}`, body)
}

export async function removeClubMember(userId: number, reason = '') {
  await api.post('/api/club-membership/remove', { userId, reason })
}

export async function addPastActionToUser(korisnikId: number, formData: FormData) {
  await api.post(`/api/korisnici/${korisnikId}/dodaj-proslu-akciju`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
