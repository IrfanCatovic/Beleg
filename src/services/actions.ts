import api from './api'
import type { AkcijaDetail, AkcijaListItem } from '../types/akcija'
import type { Prijava } from '../types/prijava'

export interface AkcijeListResponse {
  aktivne?: AkcijaListItem[]
  zavrsene?: AkcijaListItem[]
  vodeneAktivne?: AkcijaListItem[]
  vodeneZavrsene?: AkcijaListItem[]
  mojePrivatneAktivne?: AkcijaListItem[]
  mojePrivatneZavrsene?: AkcijaListItem[]
}

export async function fetchAkcije() {
  const res = await api.get<AkcijeListResponse>('/api/akcije')
  return res.data
}

export interface MojePrijaveResponse {
  prijavljeneAkcije?: number[]
  otkaziveAkcije?: number[]
}

export async function fetchMojePrijave() {
  const res = await api.get<MojePrijaveResponse>('/api/moje-prijave')
  return res.data
}

export async function fetchAkcijaById(id: number | string, inviteToken?: string) {
  const res = await api.get<AkcijaDetail>(`/api/akcije/${id}`, inviteToken ? { params: { inviteToken } } : undefined)
  return res.data
}

export async function fetchPrijaveZaAkciju(id: number | string) {
  const res = await api.get<{ prijave?: Prijava[] }>(`/api/akcije/${id}/prijave`)
  return res.data.prijave ?? []
}

export async function fetchMojaPrijavaZaAkciju(id: number | string) {
  const res = await api.get(`/api/akcije/${id}/moja-prijava`)
  return res.data
}

export async function prijaviNaAkciju(
  id: number | string,
  payload?: Record<string, unknown>,
  config?: { params?: Record<string, string> },
) {
  const res = await api.post(`/api/akcije/${id}/prijavi`, payload ?? {}, config)
  return res.data
}

export async function updateMojaPrijava(
  id: number | string,
  payload: Record<string, unknown>,
  config?: { params?: Record<string, string> },
) {
  const res = await api.patch(`/api/akcije/${id}/moja-prijava`, payload, config)
  return res.data
}

export async function otkaziPrijavu(id: number | string) {
  await api.delete(`/api/akcije/${id}/prijavi`)
}

export async function deleteAkcija(id: number | string) {
  await api.delete(`/api/akcije/${id}`)
}

export async function dodajPrevoz(id: number | string, data: Record<string, unknown>) {
  await api.post(`/api/akcije/${id}/prevoz`, data)
}

export async function obrisiPrevoz(akcijaId: number | string, prevozId: number) {
  await api.delete(`/api/akcije/${akcijaId}/prevoz/${prevozId}`)
}

export async function updatePrijavaStatus(prijavaId: number, status: string) {
  await api.post(`/api/prijave/${prijavaId}/status`, { status })
}

export async function updatePrijavaPlatio(prijavaId: number, platio: boolean) {
  await api.patch(`/api/prijave/${prijavaId}/platio`, { platio })
}

export async function deletePrijava(prijavaId: number) {
  await api.delete(`/api/prijave/${prijavaId}`)
}

export async function dodajClanaPopeoSe(akcijaId: number | string, korisnikId: number) {
  await api.post(`/api/akcije/${akcijaId}/dodaj-clana-popeo-se`, { korisnikId })
}

export async function cancelParticipationRequest(akcijaId: number | string, requestId: number) {
  await api.patch(`/api/akcije/${akcijaId}/participation-requests/${requestId}/cancel`)
}
