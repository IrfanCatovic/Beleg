import type { AxiosInstance } from 'axios'
import type { AkcijaListItem } from '../types/akcija'

export interface AkcijeListResponse {
  aktivne?: AkcijaListItem[]
  zavrsene?: AkcijaListItem[]
  vodeneAktivne?: AkcijaListItem[]
  vodeneZavrsene?: AkcijaListItem[]
  mojePrivatneAktivne?: AkcijaListItem[]
  mojePrivatneZavrsene?: AkcijaListItem[]
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
