export type PrijavaStatus = 'prijavljen' | 'popeo se' | 'nije uspeo' | 'otkazano'

export interface PrijavaRentItem {
  rentId: number
  kolicina: number
}

export interface Prijava {
  id: number
  korisnik: string
  fullName?: string
  avatarUrl?: string
  isProfiGuide?: boolean
  prijavljenAt: string
  status: PrijavaStatus
  platio?: boolean
  selectedSmestajIds?: number[]
  selectedPrevozIds?: number[]
  selectedRentItems?: PrijavaRentItem[]
  saldo?: number
  isClanKluba?: boolean
}
