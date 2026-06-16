import { useEffect, useState } from 'react'
import { fetchAkcijaById, fetchPrijaveZaAkciju } from '../../services/actions'
import { fetchKlub } from '../../services/club'
import { fetchKorisnici, fetchKorisnikByIdOrUsername } from '../../services/users'
import { getApiErrorMessage } from '../../utils/apiError'
import { parseClubCurrency } from '../../utils/clubCurrency'
import { canManageHostAkcija } from '../../utils/canManageAkcija'
import type { User } from '../../context/AuthContext'
import type { PrevozParticipant } from '../../components/action-details/TransportCard'
import type { Akcija } from '../../types/akcija'
import type { Prijava } from '../../types/prijava'
import type { KorisnikRef } from '../../types/korisnik'

type ClubMember = KorisnikRef

export interface UseActionDetailsDataParams {
  id: string | undefined
  inviteToken: string
  user: User | null
  loadErrorFallback: string
}

export function useActionDetailsData({ id, inviteToken, user, loadErrorFallback }: UseActionDetailsDataParams) {
  const [akcija, setAkcija] = useState<Akcija | null>(null)
  const [prijave, setPrijave] = useState<Prijava[]>([])
  const [canSeePrijave, setCanSeePrijave] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([])
  const [clubCurrency, setClubCurrency] = useState('RSD')
  const [prevozPrijave, setPrevozPrijave] = useState<Record<number, PrevozParticipant[]>>({})

  useEffect(() => {
    let cancelled = false
    const fetchAkcija = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchAkcijaById(id!, inviteToken || undefined)
        if (!cancelled) setAkcija(data)
      } catch (err: unknown) {
        if (!cancelled) setError(getApiErrorMessage(err, loadErrorFallback))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAkcija()
    return () => {
      cancelled = true
    }
  }, [id, inviteToken, loadErrorFallback])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchKlub()
      .then((data) => {
        if (!cancelled) setClubCurrency(parseClubCurrency(data?.valuta as string | undefined))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    const enrichWithAvatars = async (items: Prijava[]): Promise<Prijava[]> => {
      return Promise.all(
        items.map(async (p) => {
          const existingAvatar = (p as { avatarUrl?: string; avatar_url?: string }).avatarUrl || (p as { avatar_url?: string }).avatar_url
          if (existingAvatar) {
            return { ...p, avatarUrl: existingAvatar }
          }
          try {
            if (!p.korisnik) return p
            const korisnik = await fetchKorisnikByIdOrUsername(p.korisnik)
            const avatar = korisnik?.avatar_url
            if (avatar) {
              return { ...p, avatarUrl: avatar }
            }
          } catch {
            // ignore, zadrži bez avatara
          }
          return p
        }),
      )
    }

    if (!id || !user || !akcija || akcija.limited) {
      setPrijave([])
      setCanSeePrijave(false)
      return
    }

    const run = async () => {
      try {
        const list: Prijava[] = await fetchPrijaveZaAkciju(id!)
        const enriched = await enrichWithAvatars(list)
        setPrijave(enriched)
        setCanSeePrijave(true)
        return
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 403) {
          setPrijave([])
          setCanSeePrijave(false)
          return
        }
        setPrijave([])
        setCanSeePrijave(false)
      }
    }
    void run()
  }, [id, user, akcija])

  useEffect(() => {
    if (!user || !akcija || !canManageHostAkcija(user, {
      klubId: akcija.klubId,
      organizatorTip: akcija.organizatorTip,
      vodicId: akcija.vodicId,
      vodicUsername: akcija.vodic?.username,
    }) || !akcija.isCompleted) {
      setClubMembers([])
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const korisnici = await fetchKorisnici()
        if (!cancelled) setClubMembers(korisnici)
      } catch {
        if (!cancelled) setClubMembers([])
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [user, akcija])

  useEffect(() => {
    if (!user || !akcija || akcija.limited || !canSeePrijave) {
      setPrevozPrijave({})
      return
    }

    const map: Record<number, PrevozParticipant[]> = {}
    for (const p of prijave) {
      if (p.status === 'otkazano') continue
      for (const prevozId of p.selectedPrevozIds || []) {
        if (!map[prevozId]) map[prevozId] = []
        map[prevozId].push({
          prijavaId: p.id,
          korisnik: p.korisnik,
          fullName: p.fullName,
          avatarUrl: p.avatarUrl || (p as { avatar_url?: string }).avatar_url,
        })
      }
    }
    setPrevozPrijave(map)
  }, [user, akcija, canSeePrijave, prijave])

  const refreshPrijave = async () => {
    if (!id) return
    try {
      const list: Prijava[] = await fetchPrijaveZaAkciju(id!)
      const avatarMap = new Map<number, string | undefined>()
      prijave.forEach((p) => avatarMap.set(p.id, p.avatarUrl))
      setPrijave(
        list.map((p) => ({
          ...p,
          avatarUrl: p.avatarUrl || (p as { avatar_url?: string }).avatar_url || avatarMap.get(p.id),
        })),
      )
    } catch {
      // ignore
    }
  }

  const reloadAkcija = async () => {
    if (!id) return
    try {
      const data = await fetchAkcijaById(id, inviteToken || undefined)
      setAkcija(data)
    } catch {
      // ignore
    }
  }

  return {
    akcija,
    setAkcija,
    prijave,
    setPrijave,
    canSeePrijave,
    loading,
    error,
    clubMembers,
    clubCurrency,
    prevozPrijave,
    reloadAkcija,
    refreshPrijave,
  }
}
