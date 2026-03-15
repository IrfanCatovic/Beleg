import { useEffect, useState, useMemo } from 'react'
import api from '../services/api'
import { serbianSearchIncludes } from '../utils/serbianSearchUtils'

export interface SearchKorisnik {
  id: number
  username: string
  fullName?: string
  avatar_url?: string
  role: string
  klubNaziv?: string
  klubLogoUrl?: string
}

export interface SearchAkcija {
  id: number
  naziv: string
  planina?: string
  vrh?: string
  datum: string
  opis?: string
  tezina?: string
  isCompleted?: boolean
}

export interface SearchTransakcija {
  id: number
  tip: string
  iznos: number
  opis?: string
  datum: string
  korisnik?: { fullName?: string; username?: string }
}

export interface GlobalSearchResults {
  clanovi: SearchKorisnik[]
  akcije: SearchAkcija[]
  finansije: SearchTransakcija[]
}

const MAX_PER_TAB = 8

function filterKorisnici(list: SearchKorisnik[], q: string): SearchKorisnik[] {
  if (!q.trim()) return []
  return list.filter(
    (k) =>
      serbianSearchIncludes(k.username || '', q) ||
      serbianSearchIncludes(k.fullName || '', q)
  )
}

function filterAkcije(list: SearchAkcija[], q: string): SearchAkcija[] {
  if (!q.trim()) return []
  return list.filter(
    (a) =>
      serbianSearchIncludes(a.naziv || '', q) ||
      serbianSearchIncludes(a.planina || '', q) ||
      serbianSearchIncludes(a.vrh || '', q) ||
      serbianSearchIncludes(a.opis || '', q)
  )
}

function filterTransakcije(list: SearchTransakcija[], q: string): SearchTransakcija[] {
  if (!q.trim()) return []
  return list.filter(
    (t) =>
      serbianSearchIncludes(t.opis || '', q) ||
      serbianSearchIncludes(t.korisnik?.fullName || '', q) ||
      serbianSearchIncludes(t.korisnik?.username || '', q)
  )
}

/**
 * Učitava podatke za pretragu (članovi, akcije, opciono finansije) i filtrira po query-ju.
 * Vraća loading stanje i rezultate ograničene na MAX_PER_TAB po kategoriji.
 */
export function useGlobalSearch(
  debouncedQuery: string,
  options: { canSeeFinances: boolean; enabled?: boolean }
): { loading: boolean; results: GlobalSearchResults; error: string | null } {
  const { canSeeFinances, enabled = true } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [korisnici, setKorisnici] = useState<SearchKorisnik[]>([])
  const [akcije, setAkcije] = useState<SearchAkcija[]>([])
  const [transakcije, setTransakcije] = useState<SearchTransakcija[]>([])

  const hasQuery = debouncedQuery.trim().length >= 2

  useEffect(() => {
    if (!enabled || !hasQuery) {
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const from = new Date()
    from.setFullYear(from.getFullYear() - 1)
    const to = new Date()
    const fromStr = from.toISOString().slice(0, 10)
    const toStr = to.toISOString().slice(0, 10)

    const promises: Promise<void>[] = []

    promises.push(
      api.get('/api/korisnici').then((res) => {
        if (!cancelled) setKorisnici(res.data.korisnici || [])
      })
    )
    promises.push(
      api.get('/api/akcije').then((res) => {
        const aktivne = res.data.aktivne || []
        const zavrsene = res.data.zavrsene || []
        if (!cancelled) setAkcije([...aktivne, ...zavrsene])
      })
    )
    if (canSeeFinances) {
      promises.push(
        api.get(`/api/finansije/dashboard?from=${fromStr}&to=${toStr}`).then((res) => {
          if (!cancelled) setTransakcije(res.data?.transakcije || [])
        })
      )
    }

    Promise.all(promises)
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || 'Greška pri pretrazi')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, hasQuery, enabled, canSeeFinances])

  const results = useMemo(() => {
    if (!hasQuery) {
      return { clanovi: [], akcije: [], finansije: [] }
    }
    const q = debouncedQuery.trim()
    return {
      clanovi: filterKorisnici(korisnici, q).slice(0, MAX_PER_TAB),
      akcije: filterAkcije(akcije, q).slice(0, MAX_PER_TAB),
      finansije: filterTransakcije(transakcije, q).slice(0, MAX_PER_TAB),
    }
  }, [hasQuery, debouncedQuery, korisnici, akcije, transakcije])

  return { loading, results, error }
}
