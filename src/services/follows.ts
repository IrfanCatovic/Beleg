import api from './api'

export interface FollowStatusResponse {
  outgoing: 'none' | 'pending' | 'accepted'
  incoming: 'none' | 'pending' | 'accepted'
  outgoingFollowId?: number
  incomingFollowId?: number
}

export async function fetchFollowStatus(targetId: number) {
  const res = await api.get<FollowStatusResponse>(`/api/follows/status/${targetId}`)
  return res.data
}

export async function sendFollowRequest(targetId: number) {
  await api.post('/api/follows/requests', { targetId })
}

export async function unfollowUser(targetId: number) {
  await api.delete(`/api/follows/user/${targetId}`)
}

export async function cancelFollowRequest(targetId: number) {
  await api.delete(`/api/follows/user/${targetId}`)
}

export async function acceptFollowRequest(followId: number) {
  await api.patch(`/api/follows/requests/${followId}/accept`)
}

export async function rejectFollowRequest(followId: number) {
  await api.delete(`/api/follows/requests/${followId}`)
}

export async function fetchUserFollowingList(userIdOrUsername: string | number) {
  const res = await api.get<{ users?: unknown[] }>(
    `/api/follows/user/${encodeURIComponent(String(userIdOrUsername))}/following`,
  )
  return res.data.users ?? []
}

export async function fetchUserFollowersList(userIdOrUsername: string | number) {
  const res = await api.get<{ users?: unknown[] }>(
    `/api/follows/user/${encodeURIComponent(String(userIdOrUsername))}/followers`,
  )
  return res.data.users ?? []
}
