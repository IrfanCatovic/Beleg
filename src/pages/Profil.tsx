import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

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
  ukupnoKm?: number           // ← DODATO da TS ne baca grešku
  ukupnoMetaraUspona?: number // ← DODATO da TS ne baca grešku
}

interface KorisnikStatistika {
  ukupnoKm: number
  ukupnoMetaraUspona: number
  brojPopeoSe: number
}

export default function Profil() {
  const { isLoggedIn, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [uspesneAkcije, setUspesneAkcije] = useState<UspesnaAkcija[]>([])
  const [statistika, setStatistika] = useState<KorisnikStatistika>({
    ukupnoKm: 0,
    ukupnoMetaraUspona: 0,
    brojPopeoSe: 0,
  })
  const [rank, setRank] = useState({ naziv: 'Početnik', boja: '#E0D9C9' })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoggedIn) return

    const fetchProfilData = async () => {
      setLoading(true)
      try {
        const res = await api.get('/api/moje-popeo-se')
        setUspesneAkcije(res.data.uspesneAkcije || [])

        // Statistika iz baze (ne iz user objekta)
        const stats = res.data.statistika || {}
        setStatistika({
          ukupnoKm: stats.ukupnoKm || 0,
          ukupnoMetaraUspona: stats.ukupnoMetaraUspona || 0,
          brojPopeoSe: stats.brojPopeoSe || 0,
        })
      } catch (err: any) {
        console.error("Greška:", err)
        setError(err.response?.data?.error || 'Greška pri učitavanju profila')
      } finally {
        setLoading(false)
      }
    }

    fetchProfilData()
  }, [isLoggedIn])

  // Računanje ranka na osnovu statistike
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

  if (!isLoggedIn) {
    return <div className="text-center py-10">Morate se ulogovati da biste vidjeli profil.</div>
  }

  if (loading) return <div className="text-center py-10">Učitavanje profila...</div>

  if (error) return <div className="text-center py-10 text-red-600">{error}</div>

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* Header sa rankom */}
      <div className="text-center mb-10">
        <div 
          className="inline-block px-6 py-3 rounded-full text-xl font-bold mb-4 shadow-md"
          style={{ backgroundColor: rank.boja, color: rank.boja === '#000000' ? '#FFD700' : 'white' }}
        >
          {rank.naziv}
        </div>
        <h2 className="text-3xl font-bold" style={{ color: '#41ac53' }}>
          {user?.fullName} (@{user?.username})
        </h2>
      </div>

      {/* Statistička sekcija */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-10">
        <h3 className="text-xl font-semibold mb-6 text-center" style={{ color: '#41ac53' }}>
          Tvoja planinarska statistika
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-[#41ac53]">
              {statistika.ukupnoMetaraUspona.toLocaleString('sr-RS')} m
            </p>
            <p className="text-sm text-gray-600 mt-1">Ukupni uspon</p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-[#41ac53]">
              {statistika.ukupnoKm.toLocaleString('sr-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km
            </p>
            <p className="text-sm text-gray-600 mt-1">Ukupna dužina staza</p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-[#41ac53]">
              {statistika.brojPopeoSe}
            </p>
            <p className="text-sm text-gray-600 mt-1">Akcija popeo se</p>
          </div>
        </div>
      </div>

      {/* Lista uspešnih akcija */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-semibold mb-6" style={{ color: '#41ac53' }}>
          Akcije na koje si se popeo
        </h3>

        {uspesneAkcije.length === 0 ? (
          <p className="text-gray-600 text-center py-8">
            Još nisi označen kao uspešno završen ni na jednoj akciji.
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
                  {/* Zeleni badge u desnom gornjem ćošku */}
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
                    <strong>Dužina staze:</strong> {akcija.ukupnoKm?.toFixed(1) || '0.0'} km
                  </p>
                  <p className="text-sm text-gray-600 mb-1">
                    <strong>Uspon:</strong> {akcija.ukupnoMetaraUspona?.toLocaleString('sr-RS') || '0'} m
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
  )
}