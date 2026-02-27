import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

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
  fullName: string
  avatar_url?: string
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

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto relative">
      {/* Dugme Dodaj staru akciju samo admin/vodič */}
      {currentUser && ['admin', 'vodic'].includes(currentUser?.role) && (
        <button
          onClick={handleDodajStaruAkciju}
          className="absolute top-4 right-4 z-10 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          Dodaj staru akciju
        </button>
      )}

      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Avatar ili slika profila */}
            <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-[#41ac53] to-[#2e8b4a] flex items-center justify-center text-white font-bold text-5xl flex-shrink-0">
              {korisnik.avatar_url && !avatarLoadFailed ? (
                <img
                  src={korisnik.avatar_url}
                  alt={korisnik.fullName}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : null}
              <span className={korisnik.avatar_url && !avatarLoadFailed ? 'invisible' : ''}>
                {korisnik.fullName.charAt(0).toUpperCase()}
              </span>
            </div>

            <div className="text-center md:text-left">
              <h1 className="text-4xl font-bold text-gray-900">{korisnik.fullName}</h1>
              <p className="text-xl text-gray-600 mt-2">@{korisnik.username}</p>
              <span className={`inline-block mt-4 px-4 py-1 rounded-full text-sm font-medium ${
                korisnik.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`}>
                {korisnik.role === 'admin' ? 'Admin' : 'Član'}
              </span>
              <p className="text-gray-500 mt-4">
                Pridružio se: {new Date(korisnik.createdAt).toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
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
          <h3 className="text-2xl font-semibold mb-6" style={{ color: '#41ac53' }}>
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