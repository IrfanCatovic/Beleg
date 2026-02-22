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
}

export default function Profil() {
  const { isLoggedIn, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [uspesneAkcije, setUspesneAkcije] = useState<UspesnaAkcija[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoggedIn) return

    const fetchUspesneAkcije = async () => {
      setLoading(true)
      try {
        const res = await api.get('/api/moje-popeo-se')
        setUspesneAkcije(res.data.uspesneAkcije || [])
      } catch (err: any) {
        console.error("Greška:", err)
        setError(err.response?.data?.error || 'Greška pri učitavanju uspešnih akcija')
      } finally {
        setLoading(false)
      }
    }

    fetchUspesneAkcije()
  }, [isLoggedIn])

  if (!isLoggedIn) {
    return <div className="text-center py-10">Morate se ulogovati da biste vidjeli profil.</div>
  }

  if (loading) return <div className="text-center py-10">Učitavanje profila...</div>

  if (error) return <div className="text-center py-10 text-red-600">{error}</div>

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl font-bold text-center mb-8" style={{ color: '#41ac53' }}>
        {user?.fullName} (@{user?.username})
      </h2>

      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-semibold mb-6">Akcije na koje si se popeo</h3>

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