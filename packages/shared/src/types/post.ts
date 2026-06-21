/**
 * Post feed — normalizovani tip za klijente.
 * Backend JSON koristi `user` i `myLiked`; servis mapira u `author` i `likedByMe`.
 */

export interface PostCommentUser {
  id: number
  username: string
  fullName?: string
  avatarUrl?: string
  isProfiGuide?: boolean
}

export interface PostComment {
  id: number
  content: string
  createdAt: string
  user: PostCommentUser
}

export interface PostLikeUser {
  id: number
  username: string
  fullName?: string
  avatarUrl?: string
}

export interface PostUser {
  id: number
  username: string
  fullName?: string
  avatarUrl?: string
  isProfiGuide?: boolean
}

export interface Post {
  id: number
  content: string
  createdAt: string
  author: PostUser
  likeCount?: number
  commentCount?: number
  likedByMe?: boolean
  imageUrl?: string
}

export interface PostFeedItem extends Post {
  [key: string]: unknown
}
