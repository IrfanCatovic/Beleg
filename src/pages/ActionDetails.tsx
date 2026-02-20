import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../services/api'

interface Akcija {
  id: number
  naziv: string
  vrh: string
  datum: string
  opis: string
  tezina: string
  slikaUrl: string
  createdAt: string
  updatedAt: string
}

export default function ActionDetails() {
  const { id } = useParams<{ id: string }>()
  const [akcija, setAkcija] = useState<Akcija | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchAkcija = async () => {
      try {
        const res = await api.get(`/api/akcije/${id}`)
        setAkcija(res.data)
      } catch (err: any) {
        setError(err.response?.data?.error || 'Greška pri učitavanju akcije')
      } finally {
        setLoading(false)
      }
    }

    fetchAkcija()
  }, [id])

  if (loading) return <div className="text-center py-20">Učitavanje akcije...</div>
  if (error || !akcija) return <div className="text-center py-20 text-red-600">{error || 'Akcija nije pronađena'}</div>

  return (
    <div className="py-10 px-4 max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Slika na vrhu */}
        <div className="relative h-64 md:h-96">
          <img
            src={akcija.slikaUrl || 'https://via.placeholder.com/1200x600?text=Akcija'}
            alt={akcija.naziv}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div className="absolute bottom-6 left-6 text-white">
            <h1 className="text-4xl md:text-5xl font-bold">{akcija.naziv}</h1>
            <p className="text-xl mt-2">{akcija.vrh}</p>
          </div>
        </div>

        {/* Detalji */}
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-semibold mb-4" style={{ color: '#41ac53' }}>Informacije</h3>
              <p className="text-gray-700 mb-2"><strong>Datum:</strong> {new Date(akcija.datum).toLocaleDateString('sr-RS')}</p>
              <p className="text-gray-700 mb-2"><strong>Težina:</strong> <span className="font-medium">{akcija.tezina}</span></p>
              <p className="text-gray-700"><strong>Opis:</strong> {akcija.opis || 'Nema opisa'}</p>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4" style={{ color: '#41ac53' }}>Dodatno</h3>
              <p className="text-gray-500">Kreirano: {new Date(akcija.createdAt).toLocaleDateString('sr-RS')}</p>
              <p className="text-gray-500">Poslednja izmena: {new Date(akcija.updatedAt).toLocaleDateString('sr-RS')}</p>
            </div>
          </div>


          <button className="mt-8 w-full md:w-auto px-8 py-4 bg-[#41ac53] text-white rounded-xl font-medium hover:bg-[#3a9a4a] transition-colors">
            Pridruži se akciji
          </button>
        </div>
      </div>
    </div>
  )
}