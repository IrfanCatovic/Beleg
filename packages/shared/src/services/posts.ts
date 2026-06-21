import type { AxiosInstance } from 'axios'
import type { Post, PostComment, PostLikeUser, PostUser } from '../types/post'

export interface PostsPage {
  posts: Post[]
  total: number
}

/** Raw backend shape from posts_feed.go (user + myLiked). */
export type PostApiRaw = {
  id: number
  content: string
  createdAt: string
  imageUrl?: string
  likeCount?: number
  commentCount?: number
  user?: PostUser
  author?: PostUser
  myLiked?: boolean
  likedByMe?: boolean
}

export function normalizePost(raw: PostApiRaw): Post {
  return {
    id: raw.id,
    content: raw.content,
    createdAt: raw.createdAt,
    imageUrl: raw.imageUrl,
    likeCount: raw.likeCount,
    commentCount: raw.commentCount,
    author: raw.user ?? raw.author ?? { id: 0, username: '' },
    likedByMe: raw.myLiked ?? raw.likedByMe ?? false,
  }
}

export async function fetchPosts(
  client: AxiosInstance,
  limit: number,
  offset: number,
): Promise<PostsPage> {
  const res = await client.get<{ posts?: PostApiRaw[]; total?: number }>('/api/posts', {
    params: { limit, offset },
  })
  const posts = (res.data.posts ?? []).map(normalizePost)
  return { posts, total: res.data.total ?? 0 }
}

export async function fetchPostById(client: AxiosInstance, postId: number): Promise<Post> {
  const res = await client.get<{ post: PostApiRaw }>(`/api/posts/${postId}`)
  return normalizePost(res.data.post)
}

export async function createPost(
  client: AxiosInstance,
  payload: FormData | { content: string },
): Promise<unknown> {
  const res = await client.post('/api/posts', payload)
  return res.data
}

export async function deletePost(client: AxiosInstance, postId: number): Promise<void> {
  await client.delete(`/api/posts/${postId}`)
}

export async function updatePostContent(
  client: AxiosInstance,
  postId: number,
  content: string,
): Promise<void> {
  await client.patch(`/api/posts/${postId}`, { content })
}

export async function togglePostLike(
  client: AxiosInstance,
  postId: number,
): Promise<{ liked?: boolean; likeCount?: number }> {
  const res = await client.post<{ liked?: boolean; likeCount?: number }>(`/api/posts/${postId}/like`)
  return res.data
}

export async function fetchPostLikes(
  client: AxiosInstance,
  postId: number,
): Promise<{ likes: PostLikeUser[]; count: number }> {
  const res = await client.get<{ likes?: PostLikeUser[]; count?: number }>(`/api/posts/${postId}/likes`)
  return { likes: res.data.likes ?? [], count: res.data.count ?? 0 }
}

export async function fetchPostComments(
  client: AxiosInstance,
  postId: number,
  limit = 20,
  offset = 0,
): Promise<{ comments: PostComment[]; total: number }> {
  const res = await client.get<{ comments?: PostComment[]; total?: number }>(
    `/api/posts/${postId}/comments`,
    { params: { limit, offset } },
  )
  return { comments: res.data.comments ?? [], total: res.data.total ?? 0 }
}

export async function createPostComment(
  client: AxiosInstance,
  postId: number,
  content: string,
): Promise<PostComment | undefined> {
  const res = await client.post<{ comment?: PostComment }>(`/api/posts/${postId}/comments`, { content })
  return res.data.comment
}

export async function deletePostComment(
  client: AxiosInstance,
  postId: number,
  commentId: number,
): Promise<void> {
  await client.delete(`/api/posts/${postId}/comments/${commentId}`)
}
