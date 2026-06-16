/** Blokiranje korisnika — usklađeno sa backend/internal/models/block.go */

export interface BlockStatus {
  blockedByMe?: boolean
  blockedByTarget?: boolean
}

export interface BlockedUser {
  id: number
  username: string
  fullName?: string
  avatarUrl?: string
}
