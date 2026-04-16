export type ClubCurrencyCode = 'RSD' | 'BAM' | 'HRK' | 'EUR'

const ALLOWED: ClubCurrencyCode[] = ['RSD', 'BAM', 'HRK', 'EUR']

export function parseClubCurrency(raw: unknown): ClubCurrencyCode {
  const u = String(raw ?? 'RSD').trim().toUpperCase()
  return (ALLOWED.includes(u as ClubCurrencyCode) ? u : 'RSD') as ClubCurrencyCode
}
