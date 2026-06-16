export interface ObavestenjeItem {
  id: number
  userId: number
  type: string
  title: string
  body?: string
  link?: string
  metadata?: string
  readAt?: string | null
  createdAt: string
}

export interface ParticipationRequestItem {
  id: number
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  createdAt: string
  updatedAt: string
  respondedAt?: string | null
  action: {
    id: number
    naziv: string
    datum: string
    klubNaziv?: string
  }
  targetUser: {
    id: number
    username: string
    fullName?: string
    klubNaziv?: string
  }
  requestedBy: {
    id: number
    username: string
    fullName?: string
    klubNaziv?: string
  }
}

export interface FollowRequestItem {
  followId: number
  requester: {
    id: number
    username: string
    fullName?: string
    avatarUrl?: string
    klubNaziv?: string
  }
  createdAt: string
}
