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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoggedIn) return

    const fetchData = async () => {
      setLoading(true)
      try {
        // ← NOVO: dohvata dve liste iz backend-a
        const akcijeRes = await api.get('/api/akcije')
        console.log("Akcije iz baze:", akcijeRes.data)
        setAktivneAkcije(akcijeRes.data.aktivne || [])
        setZavrseneAkcije(akcijeRes.data.zavrsene || [])

        const mojeRes = await api.get('/api/moje-prijave')
        const ids = mojeRes.data.prijavljeneAkcije || []
        setPrijavljeneAkcije(new Set(ids))
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
    } catch (err: any) {
      alert(err.response?.data?.error || 'Greška pri prijavi')
      if (err.response?.data?.error?.includes("Već ste prijavljeni")) {
        setPrijavljeneAkcije(prev => new Set([...prev, akcijaId]))
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

  return (
    <div className="relative min-h-screen bg-gray-50 pb-16 md:pb-12">
      {/* Floating button "Add Action" – admin i vodič */}
      {(user?.role === 'admin' || user?.role === 'vodic') && (
        <Link
          to="/dodaj-akciju"
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full 
          bg-gradient-to-br from-green-600 to-emerald-500 text-white shadow-xl hover:bg-[#3a9a4a] active:scale-95 transition-all 
          duration-200 md:top-6 md:bottom-auto md:right-8 focus:outline-none focus:ring-2 
          focus:ring-offset-2 focus:ring-[#41ac53]"
          title="Dodaj novu akciju"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </Link>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-8 md:mb-12" style={{ color: '#41ac53' }}>
          Akcije
        </h2>

        {/*  Aktivne akcije */}
        <section className="mb-16">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Aktivne akcije</h3>
          {aktivneAkcije.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm">
              <p className="text-gray-600 text-lg">Trenutno nema aktivnih akcija.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {aktivneAkcije.map((akcija) => (
                <Link
                  key={akcija.id}
                  to={`/akcije/${akcija.id}`}
                  className="block hover:no-underline"
                >
                  <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col">
                    <div className="relative w-full h-48 sm:h-56 md:h-64 overflow-hidden shrink-0">
                      <img
                        src={akcija.slikaUrl || 'https://via.placeholder.com/600x400?text=Bez+slike'}
                        alt={akcija.naziv || 'Akcija'}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Slika+nije+dostupna'
                          e.currentTarget.onerror = null
                        }}
                      />
                    </div>

                    <div className="p-5 sm:p-6 flex flex-col grow">
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
                        {akcija.naziv}
                      </h3>
                      <p className="text-sm sm:text-base text-gray-600 mb-1">
                        <strong>Vrh:</strong> {akcija.vrh}
                      </p>
                      <p className="text-sm sm:text-base text-gray-600 mb-1">
                        <strong>Datum:</strong> {new Date(akcija.datum).toLocaleDateString('sr-RS')}
                      </p>
                      {akcija.opis && (
                        <p className="text-sm text-gray-700 mt-3 line-clamp-3 grow">
                          {akcija.opis}
                        </p>
                      )}
                      <span
                        className={`inline-block px-3 py-1 mt-4 rounded-full text-xs sm:text-sm font-medium self-start ${
                          akcija.tezina === 'lako' ? 'bg-green-100 text-green-800' :
                          akcija.tezina === 'srednje' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}
                      >
                        {akcija.tezina || 'Nije definisano'}
                      </span>

                      <div className="mt-6 pt-4 border-t border-gray-100">
  {akcija.isCompleted ? (
    // Akcija je završena – ne prikazuj nikakvo dugme za akciju
    <div className="w-full rounded-lg py-3 text-center font-medium text-white bg-gray-500 cursor-default">
      Akcija završena
    </div>
  ) : prijavljeneAkcije.has(akcija.id) ? (
    // Akcija je aktivna + korisnik je prijavljen → vidi dugme za otkazivanje
    <button
      onClick={() => handleOtkaziPrijavu(akcija.id, akcija.naziv)}
      className={`
        w-full rounded-lg py-3 font-medium text-white
        bg-red-600 hover:bg-red-700 active:bg-red-800
        transition-all duration-150 ease-in-out
        shadow-sm hover:shadow-md active:shadow-sm
        focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2
      `}
    >
      Otkaži prijavu ✕
    </button>
  ) : (
    // Akcija je aktivna + korisnik nije prijavljen → vidi dugme za prijavu
    <button
      onClick={() => handlePrijavi(akcija.id, akcija.naziv)}
      className={`
        w-full rounded-lg py-3 font-medium text-white
        bg-[#41ac53] hover:bg-[#3a9a48] active:bg-[#358c43]
        transition-all duration-150 ease-in-out
        shadow-sm hover:shadow-md active:shadow-sm
        focus:outline-none focus:ring-2 focus:ring-[#41ac53]/40 focus:ring-offset-2
      `}
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
  <h3 className="text-2xl font-bold text-gray-800 mb-6">Završene akcije</h3>
  
  {zavrseneAkcije.length === 0 ? (
    <div className="text-center py-12 bg-white rounded-xl shadow-sm">
      <p className="text-gray-600 text-lg">Trenutno nema završenih akcija.</p>
    </div>
  ) : (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
      {zavrseneAkcije.map((akcija) => (
        <Link
          key={akcija.id}
          to={`/akcije/${akcija.id}`}
          className="block hover:no-underline"
        >
          <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col opacity-90">
            {/* isti sadržaj kartice kao gore, ali bez dugmadi za prijavu/otkazivanje */}
            <div className="relative w-full h-48 sm:h-56 md:h-64 overflow-hidden shrink-0">
              <img
                src={akcija.slikaUrl || 'https://via.placeholder.com/600x400?text=Bez+slike'}
                alt={akcija.naziv || 'Akcija'}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                onError={(e) => {
                  e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Slika+nije+dostupna'
                  e.currentTarget.onerror = null
                }}
              />
            </div>

            <div className="p-5 sm:p-6 flex flex-col grow">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
                {akcija.naziv}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 mb-1">
                <strong>Vrh:</strong> {akcija.vrh}
              </p>
              <p className="text-sm sm:text-base text-gray-600 mb-1">
                <strong>Datum:</strong> {new Date(akcija.datum).toLocaleDateString('sr-RS')}
              </p>
              {akcija.opis && (
                <p className="text-sm text-gray-700 mt-3 line-clamp-3 grow">
                  {akcija.opis}
                </p>
              )}
              <span
                className={`inline-block px-3 py-1 mt-4 rounded-full text-xs sm:text-sm font-medium self-start ${
                  akcija.tezina === 'lako' ? 'bg-green-100 text-green-800' :
                  akcija.tezina === 'srednje' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}
              >
                {akcija.tezina || 'Nije definisano'}
              </span>

              {/* ← Završena akcija – nema dugmadi */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="w-full rounded-lg py-3 text-center font-medium text-white bg-gray-500 cursor-default">
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