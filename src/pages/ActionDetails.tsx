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
  isCompleted: boolean
}

interface Prijava {
  id: number
  korisnik: string  // username
  prijavljenAt: string
  status: 'prijavljen' | 'popeo se' | 'nije uspeo' | 'otkazano'
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
        // Proveri da li su sve prijave označene ako da, smatraj akciju završenom
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
        //edit action
        const handleEdit = () => {
          navigate(`/akcije/${id}/izmeni`)
        }

      //handle status update when finish action
      const handleUpdateStatus = async (prijavaId: number, newStatus: string) => {
        try {
          await api.post(`/api/prijave/${prijavaId}/status`, { status: newStatus })
          // Osvježi listu
          const res = await api.get(`/api/akcije/${id}/prijave`)
          setPrijave(res.data.prijave || [])
          const allMarked = res.data.prijave.every((p: Prijava) => p.status !== 'prijavljen')
          setIsCompleted(allMarked)
        } catch (err: any) {
          alert('Greška pri ažuriranju statusa')
        }
      }

      const handleZavrsiAkciju = async () => {


        if (!window.confirm('Da li zaista želiš da završiš ovu akciju? Posle ovoga niko više neće moći da menja prijave ili status.')) {

          return
        }

        console.log('Confirm potvrđen – šaljem POST request')

        try {
          const res = await api.post(`/api/akcije/${id}/zavrsi`)
          alert('Akcija je uspešno završena!')
          setAkcija(res.data.akcija) // osvježi akciju
        } catch (err: any) {
          console.error('Greška pri završavanju akcije:', err)
          alert(err.response?.data?.error || 'Greška pri završavanju akcije')
        }
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
        <div className="mt-12">
              <h3 className="text-2xl font-semibold mb-4" style={{ color: '#41ac53' }}>
                Prijavljeni članovi ({prijave.length})
              </h3>

              {prijave.length === 0 ? (
                <p className="text-gray-600">Još nema prijavljenih članova za ovu akciju.</p>
              ) : (
                <div className="space-y-4">
                  {prijave.map((p) => (
                    <div 
                      key={p.id} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#41ac53] to-[#2e8b4a] flex items-center justify-center text-white font-bold">
                          {p.korisnik.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{p.korisnik}</p>
                          <p className="text-sm text-gray-500">
                            Prijavljen: {new Date(p.prijavljenAt).toLocaleString('sr-RS')}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 sm:mt-0 flex items-center gap-3">
                        <span className={`px-4 py-1 rounded-full text-sm font-medium ${
                          p.status === 'popeo se' ? 'bg-green-100 text-green-800' :
                          p.status === 'nije uspeo' ? 'bg-red-100 text-red-800' :
                          p.status === 'otkazano' ? 'bg-gray-100 text-gray-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {p.status}
                        </span>

                        {/* Dugmad samo za admin/vodič i ako je prijavljen */}
                        {user && ['admin', 'vodic'].includes(user.role) && p.status=== 'prijavljen' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateStatus(p.id, 'popeo se')}
                              className="px-4 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                            >
                              Popeo se
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(p.id, 'nije uspeo')}
                              className="px-4 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                            >
                              Nije uspeo
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dugme Završi akciju (samo admin/vodič, ako je akcija još aktivna) */}
            {user && ['admin', 'vodjac'].includes(user?.role) && !akcija.isCompleted && (
              <div className="mt-10 flex justify-center">
                <button
                  onClick={handleZavrsiAkciju}
                  className="px-10 py-4 bg-[#41ac53] hover:bg-[#3a9a4a] text-white rounded-xl font-medium transition-colors shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53]/40 focus:ring-offset-2"
                >
                  Završi akciju
                </button>
              </div>
            )}
            {/* Dugmad za edit i delete – samo za admina/vodiča */}
              {user && ['admin', 'vodjac'].includes(user?.role) && !akcija.isCompleted && (
                <div className="mt-8 mb-10 flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={handleEdit}
                    className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2"
                  >
                    Izmeni akciju
                  </button>

                  <button
                    onClick={handleDelete}
                    className="w-full sm:w-auto px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2"
                  >
                    Izbriši akciju
                  </button>
                </div>
)}
      </div>

    </div>
  )
}


