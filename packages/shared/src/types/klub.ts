/** Klub — usklađeno sa backend modelom i Klub.tsx */

export interface KlubData {
  id: number
  naziv: string
  adresa?: string
  telefon?: string
  email?: string
  maticni_broj?: string
  pib?: string
  ziro_racun?: string
  sediste?: string
  web_sajt?: string
  datum_osnivanja?: string
  korisnik_admin_limit?: number
  korisnik_limit?: number
  max_storage_gb?: number
  used_storage_gb?: number
  subscribedAt?: string | null
  subscriptionEndsAt?: string | null
  logoUrl?: string
  valuta?: string
  onHold?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ClubAdminStats {
  activeMembers: number
  maxMembers: number
  adminCount: number
  maxAdmins: number
  usedStorageGb: number
  maxStorageGb: number
  subscribedAt?: string | null
  subscriptionEndsAt?: string | null
  onHold?: boolean
}

export interface ClubJoinRequestItem {
  id: number
  userId: number
  username: string
  fullName?: string
  email?: string
  status: 'pending' | 'accepted' | 'rejected' | 'blocked' | 'cancelled' | string
  createdAt: string
  updatedAt: string
}
