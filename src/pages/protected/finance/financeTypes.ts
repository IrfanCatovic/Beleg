export type Tab = 'dashboard' | 'clanarine' | 'transakcije'
export type TransakcijaFilter = 'sve' | 'uplata' | 'isplata'
export type CurrencyCode = 'RSD' | 'BAM' | 'HRK' | 'EUR'
export type DatePickType = 'day' | 'month' | 'year' | 'range'

export type { Transakcija } from '../../../types/transakcija'
import type { Transakcija } from '../../../types/transakcija'

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
