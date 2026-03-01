import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

interface Akcija {
  id: number
  naziv: string
  vrh: string
  datum: string
  opis?: string
  tezina?: string
  slikaUrl?: string
  isCompleted: boolean 
}

export default function Actions() {
  const { isLoggedIn, user } = useAuth()
  const [aktivneAkcije, setAktivneAkcije] = useState<Akcija[]>([])
  const [zavrseneAkcije, setZavrseneAkcije] = useState<Akcija[]>([])
  const [prijavljeneAkcije, setPrijavljeneAkcije] = useState<Set<number>>(new Set())
  const [otkaziveAkcije, setOtkaziveAkcije] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoggedIn) return

    const fetchData = async () => {
      setLoading(true)
      try {

        const akcijeRes = await api.get('/api/akcije')

        setAktivneAkcije(akcijeRes.data.aktivne || [])
        setZavrseneAkcije(akcijeRes.data.zavrsene || [])

        const mojeRes = await api.get('/api/moje-prijave')
        const ids = mojeRes.data.prijavljeneAkcije || []
        const otkaziveIds = mojeRes.data.otkaziveAkcije || []
        setPrijavljeneAkcije(new Set(ids))
        setOtkaziveAkcije(new Set(otkaziveIds))
      } catch (err: any) {
        setError(err.response?.data?.error || 'Greška pri učitavanju podataka')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isLoggedIn])

  const handlePrijavi = async (akcijaId: number, naziv: string) => {
    if (!confirm(`Da li želite da se prijavite za "${naziv}"?`)) return

    try {
      const response = await api.post(`/api/akcije/${akcijaId}/prijavi`)
      alert(response.data.message)

      setPrijavljeneAkcije(prev => new Set([...prev, akcijaId]))
      setOtkaziveAkcije(prev => new Set([...prev, akcijaId]))
    } catch (err: any) {
      alert(err.response?.data?.error || 'Greška pri prijavi')
      if (err.response?.data?.error?.includes("Već ste prijavljeni")) {
        setPrijavljeneAkcije(prev => new Set([...prev, akcijaId]))
        setOtkaziveAkcije(prev => new Set([...prev, akcijaId]))
      }
    }
  }

  const handleOtkaziPrijavu = async (akcijaId: number, naziv: string) => {
    if (!confirm(`Da li zaista želiš da otkažeš prijavu za "${naziv}"?`)) return

    try {
      await api.delete(`/api/akcije/${akcijaId}/prijavi`)
      alert('Uspešno ste otkazali prijavu!')

      setPrijavljeneAkcije(prev => {
        const newSet = new Set(prev)
        newSet.delete(akcijaId)
        return newSet
      })
      setOtkaziveAkcije(prev => {
        const newSet = new Set(prev)
        newSet.delete(akcijaId)
        return newSet
      })
    } catch (err: any) {
      alert(err.response?.data?.error || 'Greška pri otkazivanju prijave')
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Morate se ulogovati</h2>
          <p className="text-gray-600">Da biste videli akcije, potrebno je da se prijavite.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#41ac53] mx-auto mb-4"></div>
          <p className="text-gray-600">Učitavanje akcija...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center text-red-600">
          <h2 className="text-xl font-bold mb-2">Greška</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  const isAdminOrVodic = user?.role === 'admin' || user?.role === 'vodic'

  return (
    <div className="relative min-h-screen bg-gray-50 pb-16 md:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 md:mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-center sm:text-left order-2 sm:order-1" style={{ color: '#41ac53' }}>
            Akcije
          </h2>
          {isAdminOrVodic && (
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 order-1 sm:order-2">
              <Link
                to="/dodaj-akciju"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
                  bg-white border border-gray-200 text-gray-700 hover:border-[#41ac53] hover:text-[#41ac53] hover:bg-[#41ac53]/5
                  transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#41ac53]/30 focus:ring-offset-1"
                title="Dodaj novu akciju"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Nova akcija</span>
              </Link>
              <Link
                to="/profil/dodaj-proslu-akciju"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
                  bg-white border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-800 hover:bg-gray-50
                  transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1"
                title="Dodaj prošlu akciju (upis za člana)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Prošla akcija</span>
              </Link>
            </div>
          )}
        </div>

        {/* Aktivne akcije */}
        <section className="mb-14 sm:mb-20">
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <span className="flex h-1 w-10 sm:w-12 rounded-full bg-[#41ac53]" aria-hidden />
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Aktivne akcije
            </h3>
          </div>
          {aktivneAkcije.length === 0 ? (
            <div className="text-center py-14 sm:py-16 bg-white/80 backdrop-blur rounded-2xl border border-gray-200/80 shadow-sm">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#41ac53]/10 text-[#41ac53] mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-600 text-base sm:text-lg font-medium">Trenutno nema aktivnih akcija.</p>
              <p className="text-gray-500 text-sm mt-1">Proverite ponovo uskoro.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8">
              {aktivneAkcije.map((akcija) => (
                <Link
                  key={akcija.id}
                  to={`/akcije/${akcija.id}`}
                  className="block hover:no-underline group"
                >
                  <div className="h-full bg-white rounded-2xl overflow-hidden flex flex-col border border-gray-200/80 shadow-md hover:shadow-xl hover:border-[#41ac53]/30 transition-all duration-300 ease-out">
                    <div className="relative w-full h-44 sm:h-52 md:h-56 overflow-hidden shrink-0">
                      <img
                        src={akcija.slikaUrl || 'https://via.placeholder.com/600x400?text=Bez+slike'}
                        alt={akcija.naziv || 'Akcija'}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Slika+nije+dostupna'
                          e.currentTarget.onerror = null
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#41ac53] text-white shadow-lg">
                        Aktivna
                      </span>
                    </div>

                    <div className="p-4 sm:p-5 flex flex-col grow">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 line-clamp-2 leading-tight">
                        {akcija.naziv}
                      </h3>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p><strong className="text-gray-700">Vrh:</strong> {akcija.vrh}</p>
                        <p><strong className="text-gray-700">Datum:</strong> {new Date(akcija.datum).toLocaleDateString('sr-RS')}</p>
                      </div>
                      {akcija.opis && (
                        <p className="text-sm text-gray-600 mt-3 line-clamp-3 grow">
                          {akcija.opis}
                        </p>
                      )}
                      <span
                        className={`inline-flex items-center w-fit px-3 py-1.5 mt-4 rounded-lg text-xs font-semibold ${
                          akcija.tezina === 'lako' ? 'bg-emerald-100 text-emerald-800' :
                          akcija.tezina === 'srednje' ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {akcija.tezina || 'Nije definisano'}
                      </span>

                      <div className="mt-5 pt-4 border-t border-gray-100">
                        {akcija.isCompleted ? (
                          <div className="w-full rounded-xl py-3 text-center font-semibold text-white bg-gray-500/90 cursor-default">
                            Akcija završena
                          </div>
                        ) : otkaziveAkcije.has(akcija.id) ? (
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOtkaziPrijavu(akcija.id, akcija.naziv); }}
                            className="w-full rounded-xl py-3 font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2"
                          >
                            Otkaži prijavu ✕
                          </button>
                        ) : prijavljeneAkcije.has(akcija.id) ? (
                          <div className="w-full rounded-xl py-3 text-center font-semibold text-white bg-emerald-600 cursor-default shadow-sm">
                            Uspešno popeo!
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePrijavi(akcija.id, akcija.naziv); }}
                            className="w-full rounded-xl py-3 font-semibold text-white bg-[#41ac53] hover:bg-[#358c43] active:bg-[#2e7a3a] transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-[#41ac53]/40 focus:ring-offset-2"
                          >
                            Pridruži se
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Završene akcije */}
        <section>
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <span className="flex h-1 w-10 sm:w-12 rounded-full bg-gray-400" aria-hidden />
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight">
              Završene akcije
            </h3>
          </div>
          {zavrseneAkcije.length === 0 ? (
            <div className="text-center py-14 sm:py-16 bg-white/80 backdrop-blur rounded-2xl border border-gray-200/80 shadow-sm">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-200 text-gray-500 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-600 text-base sm:text-lg font-medium">Trenutno nema završenih akcija.</p>
              <p className="text-gray-500 text-sm mt-1">Arhiva će se popunjavati kako akcije budu završavane.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8">
              {zavrseneAkcije.map((akcija) => (
                <Link
                  key={akcija.id}
                  to={`/akcije/${akcija.id}`}
                  className="block hover:no-underline group"
                >
                  <div className="h-full bg-white rounded-2xl overflow-hidden flex flex-col border border-gray-200/80 shadow-md hover:shadow-lg hover:border-gray-300/80 transition-all duration-300 ease-out opacity-95 hover:opacity-100">
                    <div className="relative w-full h-44 sm:h-52 md:h-56 overflow-hidden shrink-0">
                      <img
                        src={akcija.slikaUrl || 'https://via.placeholder.com/600x400?text=Bez+slike'}
                        alt={akcija.naziv || 'Akcija'}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Slika+nije+dostupna'
                          e.currentTarget.onerror = null
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-600/90 text-white shadow-lg backdrop-blur-sm">
                        Završeno
                      </span>
                    </div>

                    <div className="p-4 sm:p-5 flex flex-col grow">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 line-clamp-2 leading-tight">
                        {akcija.naziv}
                      </h3>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p><strong className="text-gray-700">Vrh:</strong> {akcija.vrh}</p>
                        <p><strong className="text-gray-700">Datum:</strong> {new Date(akcija.datum).toLocaleDateString('sr-RS')}</p>
                      </div>
                      {akcija.opis && (
                        <p className="text-sm text-gray-600 mt-3 line-clamp-3 grow">
                          {akcija.opis}
                        </p>
                      )}
                      <span
                        className={`inline-flex items-center w-fit px-3 py-1.5 mt-4 rounded-lg text-xs font-semibold ${
                          akcija.tezina === 'lako' ? 'bg-emerald-100 text-emerald-800' :
                          akcija.tezina === 'srednje' ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {akcija.tezina || 'Nije definisano'}
                      </span>

                      <div className="mt-5 pt-4 border-t border-gray-100">
                        <div className="w-full rounded-xl py-3 text-center font-semibold text-white bg-gray-500/90 cursor-default shadow-sm">
                          Akcija završena
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}