import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

        interface Akcija {
        id: number
        naziv: string
        vrh: string
        datum: string
        opis?: string
        tezin?: string
        }

export default function Actions() {
  const { isLoggedIn } = useAuth()
  const [akcije, setAkcije] = useState<Akcija[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

    useEffect(() => {
        if (!isLoggedIn) return

        const fetchAkcije = async () => {
        try {
            const response = await api.get('/api/akcije')
            setAkcije(response.data.akcije) // backend vraća { akcije: [...] }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Greška pri učitavanju akcija')
        } finally {
            setLoading(false)
        }
        }

        fetchAkcije()
    }, [isLoggedIn])

  if (!isLoggedIn) {
    return <div className="text-center py-10 text-gray-700">Morate se ulogovati da biste vidjeli akcije.</div>
  }

  if (loading) return <div className="text-center py-10 text-gray-600">Učitavanje akcija...</div>

  if (error) return <div className="text-center py-10 text-red-600">{error}</div>

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl sm:text-4xl font-bold text-center mb-10" style={{ color: '#41ac53' }}>
        Trenutne akcije Adri Sentinel
      </h2>

      {akcije.length === 0 ? (
        <p className="text-center text-lg text-gray-600">Trenutno nema aktivnih akcija. Vrati se kasnije!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {akcije.map((akcija) => (
            <div
              key={akcija.id}
              className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 border border-gray-200"
            >
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2 text-gray-800">{akcija.naziv}</h3>
                <p className="text-gray-700 mb-1">
                  <span className="font-medium">Vrh:</span> {akcija.vrh}
                </p>
                <p className="text-gray-600 mb-3">
                  <span className="font-medium">Datum:</span> {akcija.datum}
                </p>
                {akcija.opis && (
                  <p className="text-gray-500 mb-4 text-sm">{akcija.opis}</p>
                )}
                {akcija.tezin && (
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    akcija.tezin === 'lako' ? 'bg-green-100 text-green-800' :
                    akcija.tezin === 'srednje' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {akcija.tezin}
                  </span>
                )}
              </div>

              <div className="px-6 pb-6">
                <button
                    onClick={async () => {
                        if (!confirm(`Da li želite da se prijavite za "${akcija.naziv}"?`)) return

                        try {
                        const response = await api.post(`/api/akcije/${akcija.id}/prijavi`)
                        alert(response.data.message)
                        // Možeš da osvežiš listu ili prikažeš "Prijavljen" badge
                        } catch (err: any) {
                        alert(err.response?.data?.error || 'Greška pri prijavi')
                        }
                    }}
                    className="w-full rounded-lg py-3 font-medium text-white transition-colors duration-200"
                    style={{ backgroundColor: '#41ac53' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fed74c'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#41ac53'}
                    >
                    Pridruži se
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}