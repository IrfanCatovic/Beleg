import api from './api'

export interface BlockStatusResponse {
  blockedByMe?: boolean
  blockedByTarget?: boolean
}

export async function fetchBlockStatus(targetId: number) {
  const res = await api.get<BlockStatusResponse>(`/api/blocks/status/${targetId}`)
  return res.data
}

export async function blockUser(targetId: number) {
  await api.post(`/api/blocks/${targetId}`)
}

export async function unblockUser(targetId: number) {
  await api.delete(`/api/blocks/${targetId}`)
}

export async function fetchMyBlocks() {
  const res = await api.get('/api/blocks/mine')
  return res.data
}
