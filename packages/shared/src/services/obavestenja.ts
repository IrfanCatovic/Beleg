import type { AxiosInstance } from 'axios'
import type { FollowRequestItem, ObavestenjeItem, ParticipationRequestItem } from '../types/obavestenje'

export async function fetchUnreadCount(client: AxiosInstance): Promise<number> {
  const res = await client.get<{ unreadCount?: number }>('/api/obavestenja/unread-count')
  return res.data.unreadCount ?? 0
}

export async function fetchObavestenja(
  client: AxiosInstance,
  limit = 30,
): Promise<ObavestenjeItem[]> {
  const res = await client.get<{ obavestenja?: ObavestenjeItem[] }>('/api/obavestenja', {
    params: { limit },
  })
  return res.data.obavestenja ?? []
}

export async function fetchObavestenjeById(
  client: AxiosInstance,
  id: number,
): Promise<ObavestenjeItem> {
  const res = await client.get<ObavestenjeItem>(`/api/obavestenja/${id}`)
  return res.data
}

export async function markObavestenjeRead(client: AxiosInstance, id: number): Promise<void> {
  await client.patch(`/api/obavestenja/${id}/read`)
}

export async function markAllObavestenjaRead(client: AxiosInstance): Promise<void> {
  await client.patch('/api/obavestenja/read-all')
}

export async function deleteObavestenje(client: AxiosInstance, id: number): Promise<void> {
  await client.delete(`/api/obavestenja/${id}`)
}

export async function fetchParticipationRequests(
  client: AxiosInstance,
  status: 'pending' | 'all' = 'pending',
): Promise<ParticipationRequestItem[]> {
  const res = await client.get<{ requests: ParticipationRequestItem[] }>('/api/moja-ucesca-zahtevi', {
    params: { status },
  })
  return res.data.requests ?? []
}

export async function fetchParticipationRequestById(
  client: AxiosInstance,
  id: number,
): Promise<ParticipationRequestItem> {
  const res = await client.get<ParticipationRequestItem>(`/api/moja-ucesca-zahtevi/${id}`)
  return res.data
}

export async function respondParticipationRequest(
  client: AxiosInstance,
  requestId: number,
  decision: 'accept' | 'reject',
): Promise<{ request: ParticipationRequestItem; message?: string }> {
  const res = await client.post<{ request: ParticipationRequestItem; message?: string }>(
    `/api/moja-ucesca-zahtevi/${requestId}/respond`,
    { decision },
  )
  return res.data
}

export async function fetchFollowRequestsPending(
  client: AxiosInstance,
): Promise<FollowRequestItem[]> {
  const res = await client.get<{ requests: FollowRequestItem[] }>('/api/follows/requests/pending')
  return res.data.requests ?? []
}

export async function broadcastObavestenje(
  client: AxiosInstance,
  title: string,
  body: string,
): Promise<void> {
  await client.post('/api/obavestenja/broadcast', { title, body })
}
