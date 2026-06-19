import type { AxiosInstance } from 'axios'

export interface FollowStatusResponse {
  outgoing: 'none' | 'pending' | 'accepted'
  incoming: 'none' | 'pending' | 'accepted'
  outgoingFollowId?: number
  incomingFollowId?: number
}

export async function fetchFollowStatus(
  client: AxiosInstance,
  targetId: number,
): Promise<FollowStatusResponse> {
  const res = await client.get<FollowStatusResponse>(`/api/follows/status/${targetId}`)
  return res.data
}

export async function sendFollowRequest(client: AxiosInstance, targetId: number): Promise<void> {
  await client.post('/api/follows/requests', { targetId })
}

export async function unfollowUser(client: AxiosInstance, targetId: number): Promise<void> {
  await client.delete(`/api/follows/user/${targetId}`)
}

export async function cancelFollowRequest(client: AxiosInstance, targetId: number): Promise<void> {
  await client.delete(`/api/follows/user/${targetId}`)
}

export async function acceptFollowRequest(client: AxiosInstance, followId: number): Promise<void> {
  await client.patch(`/api/follows/requests/${followId}/accept`)
}

export async function rejectFollowRequest(client: AxiosInstance, followId: number): Promise<void> {
  await client.delete(`/api/follows/requests/${followId}`)
}

export interface FollowingUserRef {
  id: number
  username?: string
  fullName?: string
  avatar_url?: string
}

export async function fetchUserFollowingList(
  client: AxiosInstance,
  userIdOrUsername: string | number,
): Promise<FollowingUserRef[]> {
  const res = await client.get<{ users?: FollowingUserRef[] }>(
    `/api/follows/user/${encodeURIComponent(String(userIdOrUsername))}/following`,
  )
  return res.data.users ?? []
}
