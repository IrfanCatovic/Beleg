import api from './api'
import type { Korisnik } from '../types/korisnik'
import type { UspesnaAkcija, KorisnikStatistika } from '../types/uspesnaAkcija'
import type { AkcijaZaRanking } from '../utils/rankingUtils'
import {
  addPastActionToUser as addPastActionToUserShared,
  fetchFollowCounts as fetchFollowCountsShared,
  fetchKorisnikByIdOrUsername as fetchKorisnikByIdOrUsernameShared,
  fetchKorisnikPopeoSe as fetchKorisnikPopeoSeShared,
  fetchKorisnikStatistika as fetchKorisnikStatistikaShared,
  fetchKorisnikVodio as fetchKorisnikVodioShared,
  fetchKorisnici as fetchKorisniciShared,
  patchKorisnik as patchKorisnikShared,
  removeClubMember as removeClubMemberShared,
  updateMyAvatar as updateMyAvatarShared,
  updateMyCover as updateMyCoverShared,
} from '@beleg/shared/services'

export async function fetchKorisnici(options?: { scope?: string }) {
  return fetchKorisniciShared(api, options)
}

export async function fetchKorisnikByIdOrUsername(idOrUsername: string) {
  return fetchKorisnikByIdOrUsernameShared(api, idOrUsername)
}

export async function fetchKorisnikStatistika(idOrUsername: string) {
  const s = await fetchKorisnikStatistikaShared(api, idOrUsername)
  return {
    ukupnoKm: s.ukupnoKm || 0,
    ukupnoMetaraUspona: s.ukupnoMetaraUspona || 0,
    brojPopeoSe: s.brojPopeoSe || 0,
  }
}

export async function fetchKorisnikPopeoSe(idOrUsername: string) {
  return fetchKorisnikPopeoSeShared(api, idOrUsername)
}

export async function fetchKorisnikPopeoSeById(userId: number) {
  const res = await api.get<{ uspesneAkcije?: AkcijaZaRanking[] }>(`/api/korisnici/${userId}/popeo-se`)
  return res.data.uspesneAkcije ?? []
}

export async function fetchKorisnikVodio(idOrUsername: string) {
  return fetchKorisnikVodioShared(api, idOrUsername)
}

export async function fetchFollowCounts(userId: number) {
  return fetchFollowCountsShared(api, userId)
}

export async function updateMyCoverPosition(payload: { coverPositionY?: number; coverPositionYMobile?: number }) {
  await api.patch('/api/me/cover-position', payload)
}

export async function updateMyCover(formData: FormData) {
  return updateMyCoverShared(api, formData)
}

export async function updateMyAvatar(formData: FormData) {
  return updateMyAvatarShared(api, formData)
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
  return patchKorisnikShared(api, id, body)
}

export async function removeClubMember(userId: number, reason = '') {
  return removeClubMemberShared(api, userId, reason)
}

export async function addPastActionToUser(korisnikId: number, formData: FormData) {
  return addPastActionToUserShared(api, korisnikId, formData)
}
