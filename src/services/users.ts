import api from './api'
import type { Korisnik } from '../types/korisnik'

export async function fetchKorisnici() {
  const res = await api.get<{ korisnici?: Korisnik[] }>('/api/korisnici')
  return res.data.korisnici ?? []
}

export async function fetchKorisnikByUsername(username: string) {
  const res = await api.get<Korisnik>(`/api/korisnici/${encodeURIComponent(username)}`)
  return res.data
}
