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

export interface PostFeedItem {
  id: number
  content: string
  createdAt: string
  author?: {
    id: number
    username: string
    fullName?: string
    avatarUrl?: string
  }
  likeCount?: number
  commentCount?: number
  likedByMe?: boolean
  [key: string]: unknown
}

export async function fetchPosts(limit: number, offset: number) {
  const res = await api.get<{ posts?: PostFeedItem[]; total?: number }>('/api/posts', {
    params: { limit, offset },
  })
  return res.data
}

export async function createPost(payload: FormData | { content: string }) {
  const res = await api.post('/api/posts', payload)
  return res.data
}

export async function deletePost(postId: number) {
  await api.delete(`/api/posts/${postId}`)
}

export async function fetchPostById(postId: number) {
  const res = await api.get<{ post: PostFeedItem }>(`/api/posts/${postId}`)
  return res.data.post
}

export {
  acceptFollowRequest,
  cancelFollowRequest,
  fetchFollowStatus,
  rejectFollowRequest,
  sendFollowRequest,
  unfollowUser,
} from './follows'
export type { FollowStatusResponse } from './follows'
