import api from './api'
import {
  broadcastObavestenje as broadcastObavestenjeShared,
  deleteObavestenje as deleteObavestenjeShared,
  fetchFollowRequestsPending as fetchFollowRequestsPendingShared,
  fetchObavestenja as fetchObavestenjaShared,
  fetchObavestenjeById as fetchObavestenjeByIdShared,
  fetchParticipationRequestById as fetchParticipationRequestByIdShared,
  fetchParticipationRequests as fetchParticipationRequestsShared,
  fetchUnreadCount as fetchUnreadCountShared,
  markAllObavestenjaRead as markAllObavestenjaReadShared,
  markObavestenjeRead as markObavestenjeReadShared,
  respondParticipationRequest as respondParticipationRequestShared,
} from '@beleg/shared/services'
import type { ParticipationRequestItem } from '../types/obavestenje'

export type { ObavestenjeItem, ParticipationRequestItem, FollowRequestItem } from '../types/obavestenje'

export interface PendingParticipationRequest {
  id: number
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
}

export async function fetchUnreadCount() {
  return fetchUnreadCountShared(api)
}

export async function markAllObavestenjaRead() {
  return markAllObavestenjaReadShared(api)
}

export async function fetchObavestenja(limit = 20) {
  return fetchObavestenjaShared(api, limit)
}

export async function markObavestenjeRead(id: number) {
  return markObavestenjeReadShared(api, id)
}

export async function fetchPendingParticipationRequests() {
  const requests = await fetchParticipationRequestsShared(api, 'pending')
  return requests as PendingParticipationRequest[]
}

export async function fetchParticipationRequests(status: 'pending' | 'all' = 'pending') {
  return fetchParticipationRequestsShared(api, status)
}

export async function fetchFollowRequestsPending() {
  return fetchFollowRequestsPendingShared(api)
}

export async function deleteObavestenje(id: number) {
  return deleteObavestenjeShared(api, id)
}

export async function respondParticipationRequest(requestId: number, decision: 'accept' | 'reject') {
  return respondParticipationRequestShared(api, requestId, decision)
}

export async function fetchParticipationRequestById<T = ParticipationRequestItem>(id: number) {
  return fetchParticipationRequestByIdShared(api, id) as Promise<T>
}

export { acceptFollowRequest, rejectFollowRequest } from './follows'

export async function broadcastObavestenje(title: string, body: string) {
  return broadcastObavestenjeShared(api, title, body)
}

export async function fetchObavestenjeById<T = import('../types/obavestenje').ObavestenjeItem>(id: number) {
  return fetchObavestenjeByIdShared(api, id) as Promise<T>
}
