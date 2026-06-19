import type { AxiosInstance } from 'axios'

export interface BlockStatusResponse {
  blockedByMe?: boolean
  blockedByTarget?: boolean
}

export async function fetchBlockStatus(
  client: AxiosInstance,
  targetId: number,
): Promise<BlockStatusResponse> {
  const res = await client.get<BlockStatusResponse>(`/api/blocks/status/${targetId}`)
  return res.data
}

export async function blockUser(client: AxiosInstance, targetId: number): Promise<void> {
  await client.post(`/api/blocks/${targetId}`)
}

export async function unblockUser(client: AxiosInstance, targetId: number): Promise<void> {
  await client.delete(`/api/blocks/${targetId}`)
}
