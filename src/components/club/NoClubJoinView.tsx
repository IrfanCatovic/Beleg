import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'

type Club = {
  id: number
  naziv: string
  adresa?: string
  telefon?: string
  email?: string
  logoUrl?: string
}

type JoinRequest = {
  id: number
  clubId: number
  clubNaziv?: string
  status: string
  createdAt: string
}

export default function NoClubJoinView() {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [clubs, setClubs] = useState<Club[]>([])
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [busyClubId, setBusyClubId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const load = async (q?: string) => {
    setLoading(true)
    setError('')
    try {
      const [clubsRes, reqRes] = await Promise.all([
        api.get('/api/klubovi', { params: q ? { search: q } : undefined }),
        api.get('/api/club-membership/requests/mine'),
      ])
      setClubs(clubsRes.data?.klubovi ?? [])
      setRequests(reqRes.data?.requests ?? [])
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Greška pri učitavanju klubova.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const pendingByClubId = useMemo(() => {
    const map = new Map<number, JoinRequest>()
    for (const req of requests) {
      if (req.status === 'pending') map.set(req.clubId, req)
    }
    return map
  }, [requests])

  const handleSend = async (clubId: number) => {
    setBusyClubId(clubId)
    setError('')
    try {
      await api.post('/api/club-membership/requests', { clubId })
      await load(search.trim() || undefined)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Slanje zahteva nije uspelo.'
      setError(msg)
    } finally {
      setBusyClubId(null)
    }
  }

  const handleCancel = async (requestId: number, clubId: number) => {
    setBusyClubId(clubId)
    setError('')
    try {
      await api.delete(`/api/club-membership/requests/${requestId}`)
      await load(search.trim() || undefined)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Povlačenje zahteva nije uspelo.'
      setError(msg)
    } finally {
      setBusyClubId(null)
    }
  }

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    void load(search.trim() || undefined)
  }

  return (
    <div className="min-h-[60vh] bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Pridruži se klubu</h1>
          <p className="mt-2 text-sm text-gray-600">
            Trenutno nisi član nijednog kluba. Pretraži klubove i pošalji zahtev za prijem.
          </p>

          <form onSubmit={onSearch} className="mt-5 flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pretraži klub po nazivu..."
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Pretraži
            </button>
          </form>

          {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
              Učitavanje klubova...
            </div>
          ) : clubs.length === 0 ? (
            <div className="col-span-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
              Nema klubova za prikaz.
            </div>
          ) : (
            clubs.map((club) => {
              const pendingReq = pendingByClubId.get(club.id)
              const busy = busyClubId === club.id
              return (
                <div key={club.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                  <h3 className="text-lg font-semibold text-gray-900">{club.naziv}</h3>
                  <p className="mt-1 text-sm text-gray-600">{club.adresa || 'Adresa nije uneta'}</p>
                  <p className="mt-1 text-xs text-gray-500">{club.email || club.telefon || 'Nema kontakt podataka'}</p>

                  <div className="mt-4">
                    {pendingReq ? (
                      <button
                        type="button"
                        onClick={() => void handleCancel(pendingReq.id, club.id)}
                        disabled={busy}
                        className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                      >
                        {busy ? 'Sačekaj...' : 'Povuci zahtev'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSend(club.id)}
                        disabled={busy}
                        className="rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {busy ? 'Slanje...' : 'Pošalji zahtev'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
