import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

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

interface Prijava {
  id: number
  korisnik: string  // username
  prijavljenAt: string
  status: 'prijavljen' | 'popeo se' | 'nije uspeo' | 'otkazano' // pretpostavljam da si dodao status u model Prijava
}

export default function ActionDetails() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [akcija, setAkcija] = useState<Akcija | null>(null)
  const [prijave, setPrijave] = useState<Prijava[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCompleted, setIsCompleted] = useState(false) // stanje da li je akcija završena (admin klikne "Završi akciju")

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

    const fetchPrijave = async () => {
      try {
        const res = await api.get(`/api/akcije/${id}/prijave`)
        setPrijave(res.data.prijave || [])
        // Proveri da li su sve prijave označene – ako da, smatraj akciju završenom
        const allMarked = res.data.prijave.every((p: Prijava) => p.status !== 'prijavljen')
        setIsCompleted(allMarked)
      } catch (err: any) {
        console.error('Greška pri učitavanju prijava:', err)
      }
    }

    fetchAkcija()
    fetchPrijave()
  }, [id])

  const handleDelete = async () => {
    if (!window.confirm('Da li si siguran da želiš da obrišeš ovu akciju?')) return

    try {
      await api.delete(`/api/akcije/${id}`)
      navigate('/akcije')
    } catch (err: any) {
      setError('Greška pri brisanju akcije')
    }
  }

  const handleEdit = () => {
    navigate(`/akcije/${id}/izmeni`)
  }

  const handleUpdateStatus = async (prijavaId: number, newStatus: 'popeo se' | 'nije uspeo') => {
    try {
      await api.post(`/api/prijave/${prijavaId}/status`, { status: newStatus })
      // Ponovo učitaj prijave da osvježi listu
      const res = await api.get(`/api/akcije/${id}/prijave`)
      setPrijave(res.data.prijave || [])
      const allMarked = res.data.prijave.every((p: Prijava) => p.status !== 'prijavljen')
      setIsCompleted(allMarked)
    } catch (err: any) {
      console.error('Greška pri ažuriranju statusa:', err)
    }
  }

  const handleCompleteAction = () => {
    if (!window.confirm('Da li želiš da završiš akciju? Ovo će sakriti dugmad za izmene.')) return
    setIsCompleted(true)
  }

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

          {/* Lista prijavljenih članova */}
          <div className="mt-12">
            <h3 className="text-2xl font-semibold mb-4" style={{ color: '#41ac53' }}>Prijavljeni članovi</h3>
            {prijave.length === 0 ? (
              <p className="text-gray-600">Još nema prijavljenih članova za ovu akciju.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Član</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prijavljen</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akcije (samo admin)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {prijave.map((p) => (
                      <tr key={p.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.korisnik}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(p.prijavljenAt).toLocaleDateString('sr-RS')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            p.status === 'popeo se' ? 'bg-green-100 text-green-800' :
                            p.status === 'nije uspeo' ? 'bg-red-100 text-red-800' :
                            p.status === 'otkazano' ? 'bg-gray-100 text-gray-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {user?.role === 'admin' && p.status === 'prijavljen' && !isCompleted && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'popeo se')}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                              >
                                Završio
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'nije uspeo')}
                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                              >
                                Nije uspeo
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Dugmad za admin */}
          {user?.role === 'admin' && !isCompleted && (
            <div className="mt-8 flex gap-4">
              <button
                onClick={handleDelete}
                className="px-8 py-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                Izbriši akciju
              </button>
              <button
                onClick={handleEdit}
                className="px-8 py-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                Izmeni akciju
              </button>
              <button
                onClick={handleCompleteAction}
                className="px-8 py-4 bg-[#41ac53] text-white rounded-xl font-medium hover:bg-[#3a9a4a] transition-colors"
              >
                Završi akciju
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}