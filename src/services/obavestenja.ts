import api from './api'
import type { ObavestenjeItem, ParticipationRequestItem, FollowRequestItem } from '../types/obavestenje'

export async function fetchUnreadCount() {
  const res = await api.get<{ unreadCount?: number }>('/api/obavestenja/unread-count')
  return res.data.unreadCount ?? 0
}

export async function markAllObavestenjaRead() {
  await api.patch('/api/obavestenja/read-all')
}

export async function fetchObavestenja(limit = 20) {
  const res = await api.get<{ obavestenja?: ObavestenjeItem[] }>('/api/obavestenja', { params: { limit } })
  return res.data.obavestenja ?? []
}

export async function markObavestenjeRead(id: number) {
  await api.patch(`/api/obavestenja/${id}/read`)
}

export interface PendingParticipationRequest {
  id: number
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
}

export async function fetchPendingParticipationRequests() {
  const res = await api.get<{ requests: PendingParticipationRequest[] }>('/api/moja-ucesca-zahtevi', {
    params: { status: 'pending' },
  })
  return res.data.requests ?? []
}

export async function fetchParticipationRequests(status: 'pending' | 'all' = 'pending') {
  const res = await api.get<{ requests: ParticipationRequestItem[] }>('/api/moja-ucesca-zahtevi', {
    params: { status },
  })
  return res.data.requests ?? []
}

export async function fetchFollowRequestsPending() {
  const res = await api.get<{ requests: FollowRequestItem[] }>('/api/follows/requests/pending')
  return res.data.requests ?? []
}

export async function deleteObavestenje(id: number) {
  await api.delete(`/api/obavestenja/${id}`)
}

export async function respondParticipationRequest(requestId: number, decision: 'accept' | 'reject') {
  await api.post(`/api/moja-ucesca-zahtevi/${requestId}/respond`, { decision })
}

export async function acceptFollowRequest(followId: number) {
  await api.patch(`/api/follows/requests/${followId}/accept`)
}

export async function rejectFollowRequest(followId: number) {
  await api.delete(`/api/follows/requests/${followId}`)
}

export async function broadcastObavestenje(title: string, body: string) {
  await api.post('/api/obavestenja/broadcast', { title, body })
}
