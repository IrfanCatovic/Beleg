import { useParams, useNavigate, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { getRoleLabel, getRoleStyle } from '../utils/roleUtils'

interface UspesnaAkcija {
  id: number
  naziv: string
  vrh: string
  datum: string
  opis?: string
  tezina?: string
  slikaUrl?: string
  createdAt: string
  updatedAt: string
  duzinaStazeKm?: number
  kumulativniUsponM?: number
}

interface KorisnikStatistika {
  ukupnoKm: number
  ukupnoMetaraUspona: number
  brojPopeoSe: number
}

interface Korisnik {
  id: number
  username: string
  fullName?: string
  avatar_url?: string
  email?: string
  telefon?: string
  role: 'admin' | 'clan' | 'vodic' | 'blagajnik' | 'sekretar' | 'menadzer-opreme'
  createdAt: string
  updatedAt: string
  ukupnoKm: number
  ukupnoMetaraUspona: number
  brojPopeoSe: number
}

export default function UserProfile() {
  const { id } = useParams<{ id: string }>()
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()

  const [korisnik, setKorisnik] = useState<Korisnik | null>(null)
  const [uspesneAkcije, setUspesneAkcije] = useState<UspesnaAkcija[]>([])
  const [statistika, setStatistika] = useState<KorisnikStatistika>({
    ukupnoKm: 0,
    ukupnoMetaraUspona: 0,
    brojPopeoSe: 0,
  })
  const [rank, setRank] = useState({ naziv: 'Početnik', boja: '#E0D9C9' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)

  useEffect(() => {
    const fetchProfilData = async () => {
      setLoading(true)
      try {
        // 1. Osnovni podaci korisnika
        const resKorisnik = await api.get(`/api/korisnici/${id}`)
        setKorisnik(resKorisnik.data)

        // 2. Statistika
        const resStats = await api.get(`/api/korisnici/${id}/statistika`)
        const stats = resStats.data.statistika || {}
        setStatistika({
          ukupnoKm: stats.ukupnoKm || 0,
          ukupnoMetaraUspona: stats.ukupnoMetaraUspona || 0,
          brojPopeoSe: stats.brojPopeoSe || 0,
        })

        // 3. Osvojeni vrhovi
        const resAkcije = await api.get(`/api/korisnici/${id}/popeo-se`)
        setUspesneAkcije(resAkcije.data.uspesneAkcije || [])
      } catch (err: any) {
        console.error('Greška pri učitavanju profila:', err)
        setError(err.response?.data?.error || 'Greška pri učitavanju profila')
      } finally {
        setLoading(false)
      }
    }

    fetchProfilData()
  }, [id])

  useEffect(() => {
    setAvatarLoadFailed(false)
  }, [id])

  // Računanje ranka
  useEffect(() => {
    const { ukupnoKm, ukupnoMetaraUspona } = statistika

    if (ukupnoKm <= 200 && ukupnoMetaraUspona <= 5000) {
      setRank({ naziv: 'Početnik', boja: '#ccc4b1' })
    } else if (ukupnoKm <= 900 && ukupnoMetaraUspona <= 20000) {
      setRank({ naziv: 'Istraživač', boja: '#556B2F' })
    } else if (ukupnoKm <= 3500 && ukupnoMetaraUspona <= 60000) {
      setRank({ naziv: 'Sedlar', boja: '#B7410E' })
    } else if (ukupnoKm <= 10000 && ukupnoMetaraUspona <= 140000) {
      setRank({ naziv: 'Osvajač', boja: '#8B0000' })
    } else if (ukupnoKm <= 25000 && ukupnoMetaraUspona <= 300000) {
      setRank({ naziv: 'Oblakolovac', boja: '#00CED1' })
    } else {
      setRank({ naziv: 'Legenda stijena', boja: '#000000' })
    }
  }, [statistika])

  const handleDodajStaruAkciju = () => {
    navigate(`/korisnici/${id}/dodaj-starju-akciju`)
  }

  if (loading) return <div className="text-center py-20">Učitavanje profila...</div>
  if (error || !korisnik) return <div className="text-center py-20 text-red-600">{error || 'Korisnik nije pronađen'}</div>

  const showSettings =
    currentUser && (currentUser.role === 'admin' || currentUser.role === 'sekretar' || currentUser.username === korisnik.username)
  const settingsLink =
    currentUser?.username === korisnik.username ? '/profil/podesavanja' : `/profil/podesavanja/${id}`

  return (
    <div className="pt-4 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative">

      <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
        {showSettings && (
          <Link
            to={settingsLink}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors"
            title="Podešavanja profila"
            aria-label="Podešavanja profila"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        )}
        {/* Desktop: puno dugme sa tekstom */}
        {currentUser && ['admin', 'vodic'].includes(currentUser?.role) && (
          <button
            onClick={handleDodajStaruAkciju}
            className="hidden md:inline-flex px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            Dodaj staru akciju
          </button>
        )}
      </div>

      {/* Mobile FAB  plavo dugme sa plusom, fixno u desnom donjem cosku */}
      {currentUser && ['admin', 'vodic'].includes(currentUser?.role) && (
        <button
          onClick={handleDodajStaruAkciju}
          className="md:hidden fixed bottom-6 right-6 z-20 w-14 h-14 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          title="Dodaj staru akciju"
          aria-label="Dodaj staru akciju"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      <div className="bg-white rounded-2xl shadow-xl pt-10 px-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Avatar ili slika profila */}
            <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-[#41ac53] to-[#2e8b4a] flex items-center justify-center text-white font-bold text-5xl flex-shrink-0">
              {korisnik.avatar_url && !avatarLoadFailed ? (
                <img
                  src={korisnik.avatar_url}
                  alt={korisnik.fullName || korisnik.username || ''}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : null}
              <span className={korisnik.avatar_url && !avatarLoadFailed ? 'invisible' : ''}>
                {(korisnik.fullName || korisnik.username || '?').charAt(0).toUpperCase()}
              </span>
            </div>

            <div className="text-center md:text-left">
              <h1 className="text-4xl font-bold text-gray-900">{korisnik.fullName || korisnik.username}</h1>
              <p className="text-xl text-gray-600 mt-2">@{korisnik.username}</p>
              <span className={`inline-block mt-4 px-4 py-1 rounded-full text-sm font-medium ${getRoleStyle(korisnik.role)}`}>
                {getRoleLabel(korisnik.role)}
              </span>
            <p className="text-gray-500 mt-4">
              Pridružio se: {new Date(korisnik.createdAt).toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {korisnik.email && (
              <p className="text-gray-600 mt-2 text-sm">
                <span className="font-medium">Email:</span>{' '}
                <a href={`mailto:${korisnik.email}`} className="text-[#41ac53] hover:underline">
                  {korisnik.email}
                </a>
              </p>
            )}
            {korisnik.telefon && (
              <p className="text-gray-600 mt-1 text-sm">
                <span className="font-medium">Telefon:</span>{' '}
                <a href={`tel:${korisnik.telefon}`} className="text-[#41ac53] hover:underline">
                  {korisnik.telefon}
                </a>
              </p>
            )}
          </div>
        </div>

        {/* Rank desno, mobile friendly */}
          <div className="mt-6 md:mt-0 flex md:block justify-center md:justify-end">
            <div
              className="inline-block px-8 py-4 rounded-full text-xl font-bold shadow-md"
              style={{ backgroundColor: rank.boja, color: rank.boja === '#000000' ? '#FFD700' : 'white' }}
            >
              {rank.naziv}
            </div>
          </div>
        </div>

        {/* Statistička sekcija */}
        <div className="bg-gray-50 rounded-xl p-6 mt-10">
          <h3 className="text-xl font-semibold mb-6 text-center" style={{ color: '#41ac53' }}>
            Planinarska statistika
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <p className="text-3xl font-bold text-[#41ac53]">
                {statistika.ukupnoMetaraUspona.toLocaleString('sr-RS')} m
              </p>
              <p className="text-sm text-gray-600 mt-1">Ukupni uspon</p>
            </div>

            <div className="p-4 bg-white rounded-lg shadow-sm">
              <p className="text-3xl font-bold text-[#41ac53]">
                {statistika.ukupnoKm.toLocaleString('sr-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km
              </p>
              <p className="text-sm text-gray-600 mt-1">Ukupna dužina staza</p>
            </div>

            <div className="p-4 bg-white rounded-lg shadow-sm">
              <p className="text-3xl font-bold text-[#41ac53]">
                {statistika.brojPopeoSe}
              </p>
              <p className="text-sm text-gray-600 mt-1">Akcija popeo se</p>
            </div>
          </div>
        </div>

        {/* Lista uspešnih akcija */}
        <div className="mt-12">
          <h3 className="text-2xl font-semibold mb-6 text-center" style={{ color: '#41ac53' }}>
            Akcije na koje se popeo
          </h3>

          {uspesneAkcije.length === 0 ? (
            <p className="text-gray-600 text-center py-8">
              Još nije označen kao uspešno završen ni na jednoj akciji.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {uspesneAkcije.map((akcija) => (
                <div 
                  key={akcija.id}
                  className="relative bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300"
                >
                  {/* Slika */}
                  <div className="relative w-full h-48 sm:h-56 overflow-hidden">
                    <img
                      src={akcija.slikaUrl || 'https://via.placeholder.com/600x400?text=Bez+slike'}
                      alt={akcija.naziv}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Slika+nije+dostupna'
                        e.currentTarget.onerror = null
                      }}
                    />
                    {/* Zeleni badge */}
                    <div className="absolute top-3 right-3 bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-md">
                      Popeo ✓
                    </div>
                  </div>

                  {/* Sadržaj */}
                  <div className="p-5">
                    <h4 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                      {akcija.naziv}
                    </h4>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Vrh:</strong> {akcija.vrh}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Datum:</strong> {new Date(akcija.datum).toLocaleDateString('sr-RS')}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Dužina staze:</strong> {akcija.duzinaStazeKm?.toFixed(1) || '0.0'} km
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Uspon:</strong> {akcija.kumulativniUsponM?.toLocaleString('sr-RS') || '0'} m
                    </p>
                    <span className={`inline-block px-3 py-1 mt-3 rounded-full text-xs font-medium ${
                      akcija.tezina === 'lako' ? 'bg-green-100 text-green-800' :
                      akcija.tezina === 'srednje' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {akcija.tezina || 'Nije definisano'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}