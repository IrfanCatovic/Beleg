import type { AxiosInstance } from 'axios'
import type { Korisnik } from '../types/korisnik'
import type { UspesnaAkcija, KorisnikStatistika } from '../types/uspesnaAkcija'

export async function fetchKorisnici(
  client: AxiosInstance,
  options?: { scope?: string },
): Promise<Korisnik[]> {
  const res = await client.get<{ korisnici?: Korisnik[] }>('/api/korisnici', {
    params: options?.scope ? { scope: options.scope } : undefined,
  })
  return res.data.korisnici ?? []
}

export async function fetchKorisnikByIdOrUsername(
  client: AxiosInstance,
  idOrUsername: string,
): Promise<Korisnik> {
  const res = await client.get<Korisnik>(`/api/korisnici/${encodeURIComponent(idOrUsername)}`)
  return res.data
}

export async function fetchKorisnikStatistika(
  client: AxiosInstance,
  idOrUsername: string,
): Promise<KorisnikStatistika> {
  const res = await client.get<{ statistika?: KorisnikStatistika }>(
    `/api/korisnici/${encodeURIComponent(idOrUsername)}/statistika`,
  )
  const s = res.data.statistika
  return {
    ukupnoKm: s?.ukupnoKm ?? 0,
    ukupnoMetaraUspona: s?.ukupnoMetaraUspona ?? 0,
    brojPopeoSe: s?.brojPopeoSe ?? 0,
  }
}

export async function fetchKorisnikPopeoSe(
  client: AxiosInstance,
  idOrUsername: string,
): Promise<UspesnaAkcija[]> {
  const res = await client.get<{ uspesneAkcije?: UspesnaAkcija[] }>(
    `/api/korisnici/${encodeURIComponent(idOrUsername)}/popeo-se`,
  )
  return res.data.uspesneAkcije ?? []
}

export async function fetchKorisnikVodio(
  client: AxiosInstance,
  idOrUsername: string,
): Promise<UspesnaAkcija[]> {
  const res = await client.get<{ vodeneAkcije?: UspesnaAkcija[] }>(
    `/api/korisnici/${encodeURIComponent(idOrUsername)}/vodio`,
  )
  return res.data.vodeneAkcije ?? []
}

export async function fetchFollowCounts(
  client: AxiosInstance,
  userId: number,
): Promise<{ following: number; followers: number }> {
  const res = await client.get<{ following?: number; followers?: number }>(
    `/api/follows/user/${userId}/counts`,
  )
  return { following: res.data.following ?? 0, followers: res.data.followers ?? 0 }
}

export async function updateMyAvatar(
  client: AxiosInstance,
  formData: FormData,
): Promise<{ avatar_url?: string }> {
  const res = await client.patch<{ avatar_url?: string }>('/api/me/avatar', formData)
  return res.data
}

export async function updateMyCover(
  client: AxiosInstance,
  formData: FormData,
): Promise<{ cover_image_url?: string }> {
  const res = await client.patch<{ cover_image_url?: string }>('/api/me/cover', formData)
  return res.data
}

export async function updateMe(client: AxiosInstance, formData: FormData): Promise<unknown> {
  const res = await client.patch('/api/me', formData)
  return res.data
}

export async function patchKorisnik(
  client: AxiosInstance,
  id: number,
  body: Record<string, unknown>,
): Promise<void> {
  await client.patch(`/api/korisnici/${id}`, body)
}
