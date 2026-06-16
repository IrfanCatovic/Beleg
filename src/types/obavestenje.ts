export interface ObavestenjeItem {
  id: number
  userId: number
  type: string
  title: string
  body?: string
  link?: string
  readAt?: string | null
  createdAt: string
}
