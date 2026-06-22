import api from './api'
import {
  createSuperadminKlub as createSuperadminKlubShared,
  deleteSuperadminKlub as deleteSuperadminKlubShared,
  deleteUserById as deleteUserByIdShared,
  fetchSuperadminAppStats as fetchSuperadminAppStatsShared,
  fetchSuperadminKlubovi as fetchSuperadminKluboviShared,
  fetchSuperadminUsersWithoutClub as fetchSuperadminUsersWithoutClubShared,
  updateSuperadminKlub as updateSuperadminKlubShared,
  uploadSuperadminKlubLogo as uploadSuperadminKlubLogoShared,
  type NoClubUserRow,
  type SuperadminAppStatClub,
  type SuperadminKlub,
  type SuperadminKlubStats,
} from '@beleg/shared/services'

export type { NoClubUserRow, SuperadminAppStatClub, SuperadminKlub, SuperadminKlubStats }

export async function fetchSuperadminAppStats() {
  return fetchSuperadminAppStatsShared(api)
}

export async function fetchSuperadminKlubovi() {
  return fetchSuperadminKluboviShared(api)
}

export async function fetchSuperadminUsersWithoutClub(q?: string) {
  return fetchSuperadminUsersWithoutClubShared(api, q)
}

export async function deleteSuperadminKlub(id: number) {
  return deleteSuperadminKlubShared(api, id)
}

export async function deleteUserById(id: number) {
  return deleteUserByIdShared(api, id)
}

export async function createSuperadminKlub(payload: Record<string, unknown>) {
  return createSuperadminKlubShared(api, payload)
}

export async function updateSuperadminKlub(id: number, payload: Record<string, unknown>) {
  return updateSuperadminKlubShared(api, id, payload)
}

export async function uploadSuperadminKlubLogo(id: number, formData: FormData) {
  return uploadSuperadminKlubLogoShared(api, id, formData)
}

export async function deleteSuperadminFerrata(id: number) {
  await api.delete(`/api/superadmin/ferratas/${id}`)
}
