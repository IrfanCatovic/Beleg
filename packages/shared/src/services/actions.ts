import type { AxiosInstance } from 'axios'
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

export interface MojePrijaveResponse {
  prijavljeneAkcije?: number[]
  otkaziveAkcije?: number[]
}

export interface MojaPrijavaPayload {
  status: string
  selectedSmestajIds?: number[]
  selectedPrevozIds?: number[]
  selectedRentItems?: Array<{ rentId: number; kolicina: number }>
}

export interface MojaPrijavaResponse {
  prijava: MojaPrijavaPayload | null
}

export async function fetchAkcije(
  client: AxiosInstance,
  options?: { scope?: string },
): Promise<AkcijeListResponse> {
  const res = await client.get<AkcijeListResponse>('/api/akcije', {
    params: options?.scope ? { scope: options.scope } : undefined,
  })
  return res.data
}

export async function fetchMojePrijave(client: AxiosInstance): Promise<MojePrijaveResponse> {
  const res = await client.get<MojePrijaveResponse>('/api/moje-prijave')
  return res.data
}

export async function fetchAkcijaById(
  client: AxiosInstance,
  id: number | string,
  inviteToken?: string,
): Promise<AkcijaDetail> {
  const res = await client.get<AkcijaDetail>(`/api/akcije/${id}`, {
    params: inviteToken ? { inviteToken } : undefined,
  })
  return res.data
}

export async function fetchMojaPrijavaZaAkciju(
  client: AxiosInstance,
  id: number | string,
): Promise<MojaPrijavaResponse> {
  const res = await client.get<MojaPrijavaResponse>(`/api/akcije/${id}/moja-prijava`)
  return res.data
}

export async function fetchPrijaveZaAkciju(
  client: AxiosInstance,
  id: number | string,
): Promise<Prijava[]> {
  const res = await client.get<{ prijave?: Prijava[] }>(`/api/akcije/${id}/prijave`)
  return res.data.prijave ?? []
}

export async function prijaviNaAkciju(
  client: AxiosInstance,
  id: number | string,
  payload?: Record<string, unknown>,
): Promise<unknown> {
  const res = await client.post(`/api/akcije/${id}/prijavi`, payload ?? {})
  return res.data
}

export async function updateMojaPrijava(
  client: AxiosInstance,
  id: number | string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const res = await client.patch(`/api/akcije/${id}/moja-prijava`, payload)
  return res.data
}

export async function otkaziPrijavu(client: AxiosInstance, id: number | string): Promise<void> {
  await client.delete(`/api/akcije/${id}/prijavi`)
}

export async function fetchMojePopeoSe(client: AxiosInstance): Promise<unknown> {
  const res = await client.get('/api/moje-popeo-se')
  return res.data
}
