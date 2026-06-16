export type Tab = 'dashboard' | 'clanarine' | 'transakcije'
export type TransakcijaFilter = 'sve' | 'uplata' | 'isplata'
export type CurrencyCode = 'RSD' | 'BAM' | 'HRK' | 'EUR'
export type DatePickType = 'day' | 'month' | 'year' | 'range'

export interface Transakcija {
  id: number
  tip: string
  iznos: number
  opis?: string
  datum: string
  korisnikId: number
  clanarinaKorisnikId?: number
  createdAt: string
  korisnik?: { fullName?: string; username?: string }
  clanarinaKorisnik?: { fullName?: string; username?: string }
}

export interface DashboardData {
  saldo: number
  uplate: number
  isplate: number
  transakcije: Transakcija[]
  from: string
  to: string
}

export interface ClanarinaRow {
  id: number
  fullName: string
  username: string
  platio: boolean
}
