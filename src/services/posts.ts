import api from './api'

export interface PostComment {
  id: number
  content: string
  createdAt: string
  user: {
    id: number
    username: string
    fullName?: string
    avatarUrl?: string
    isProfiGuide?: boolean
  }
}

export interface PostLikeUser {
  id: number
  username: string
  fullName?: string
  avatarUrl?: string
}

export async function fetchPostComments(postId: number, limit = 20, offset = 0) {
  const res = await api.get<{ comments?: PostComment[]; total?: number }>(`/api/posts/${postId}/comments`, {
    params: { limit, offset },
  })
  return {
    comments: res.data.comments ?? [],
    total: res.data.total ?? 0,
  }
}

export async function fetchPostLikes(postId: number) {
  const res = await api.get<{ likes?: PostLikeUser[]; count?: number }>(`/api/posts/${postId}/likes`)
  return res.data
}

export async function togglePostLike(postId: number) {
  const res = await api.post<{ liked?: boolean; likeCount?: number }>(`/api/posts/${postId}/like`)
  return res.data
}

export async function createPostComment(postId: number, content: string) {
  const res = await api.post<{ comment?: PostComment }>(`/api/posts/${postId}/comments`, { content })
  return res.data.comment
}

export async function updatePostContent(postId: number, content: string) {
  const res = await api.patch<{ post?: unknown }>(`/api/posts/${postId}`, { content })
  return res.data
}

export async function deletePostComment(postId: number, commentId: number) {
  await api.delete(`/api/posts/${postId}/comments/${commentId}`)
}

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
