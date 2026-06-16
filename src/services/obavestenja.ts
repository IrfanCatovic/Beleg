import api from './api'
import type { ObavestenjeItem } from '../types/obavestenje'

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

export interface PendingFollowRequest {
  followId: number
}

export async function fetchPendingParticipationRequests() {
  const res = await api.get<{ requests: PendingParticipationRequest[] }>('/api/moja-ucesca-zahtevi', {
    params: { status: 'pending' },
  })
  return res.data.requests ?? []
}

export async function fetchPendingFollowRequests() {
  const res = await api.get<{ requests: PendingFollowRequest[] }>('/api/follows/requests/pending')
  return res.data.requests ?? []
}
