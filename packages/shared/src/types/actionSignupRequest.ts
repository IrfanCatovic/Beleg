import type { PrijavaRentItem } from './prijava'

export type ActionSignupRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'

export interface ActionSignupRequestUser {
  id: number
  username: string
  fullName?: string
  avatarUrl?: string
  isProfiGuide?: boolean
}

export interface ActionSignupRequestAction {
  id: number
  naziv?: string
  datum?: string
  planina?: string
  vrh?: string
}

export interface ActionSignupRequest {
  id: number
  status: ActionSignupRequestStatus
  createdAt: string
  respondedAt?: string
  selectedSmestajIds?: number[]
  selectedPrevozIds?: number[]
  selectedRentItems?: PrijavaRentItem[]
  requester: ActionSignupRequestUser
  action?: ActionSignupRequestAction
}

export interface MojaSignupRequestPayload {
  id: number
  status: ActionSignupRequestStatus
  createdAt?: string
  selectedSmestajIds?: number[]
  selectedPrevozIds?: number[]
  selectedRentItems?: PrijavaRentItem[]
}
