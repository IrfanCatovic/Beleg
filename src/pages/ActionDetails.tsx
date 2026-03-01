import { useParams, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { generateActionPdfPrePolaska, generateActionPdfZavrsena } from '../utils/generateActionPdf'
import { formatDateTime } from '../utils/dateUtils'

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
  drugiVodicIme?: string
  vodic?: { fullName: string; username: string }
  addedBy?: { fullName: string; username: string }
  prijaveCount?: number
}

interface Prijava {
  id: number
  korisnik: string
  fullName?: string
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
        const prijaveList = res.data.prijave || []
        setPrijave(prijaveList)
      } catch (err: any) {
        console.error('Greška pri učitavanju prijava:', err)
      }
    }

    fetchAkcija()
    if (user) fetchPrijave()
  }, [id, user])

  const handleDelete = async () => {
    if (!window.confirm('Da li si siguran da želiš da obrišeš ovu akciju? Ova akcija će biti trajno obrisana.')) return

    try {
      await api.delete(`/api/akcije/${id}`)
      alert('Akcija je uspešno obrisana.')
      navigate('/akcije')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Greška pri brisanju akcije')
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
          const prijaveList = res.data.prijave || []
          setPrijave(prijaveList)
        } catch (err: any) {
          alert('Greška pri ažuriranju statusa')
        }
      }

      const handleZavrsiAkciju = async () => {


        if (!window.confirm('Da li zaista želiš da završiš ovu akciju? Posle ovoga niko više neće moći da menja prijave ili status.')) {

          return
        }

        try {
          const res = await api.post(`/api/akcije/${id}/zavrsi`)
          alert('Akcija je uspešno završena!')
          const updated = res.data?.akcija
          if (updated) {
            setAkcija(updated)
          } else {
            setAkcija((prev) => (prev ? { ...prev, isCompleted: true } : null))
          }
        } catch (err: any) {
          console.error('Greška pri završavanju akcije:', err)
          alert(err.response?.data?.error || 'Greška pri završavanju akcije')
        }
      }

  if (loading) return <div className="text-center py-20">Učitavanje akcije...</div>
  if (error || !akcija) return <div className="text-center py-20 text-red-600">{error || 'Akcija nije pronađena'}</div>

  const vodicIme = [akcija.vodic?.fullName, akcija.drugiVodicIme].filter(Boolean).join(', ')
  const imenaPolaznika = prijave.map((p) => (p.fullName && p.fullName.trim() ? p.fullName : p.korisnik)).join(', ')
  const uspesnoPopeli = prijave.filter((p) => p.status === 'popeo se')
  const imenaUspesnoPopeli = uspesnoPopeli.map((p) => (p.fullName && p.fullName.trim() ? p.fullName : p.korisnik)).join(', ')

  const handlePrintPrePolaska = () => {
    generateActionPdfPrePolaska({
      naziv: akcija.naziv,
      vrh: akcija.vrh,
      datum: akcija.datum,
      opis: akcija.opis || '',
      tezina: akcija.tezina || '',
      vodicIme,
      addedBy: akcija.addedBy?.fullName || '',
      brojPolaznika: prijave.length,
      imenaPolaznika,
    })
  }

  const handlePrintZavrsena = () => {
    generateActionPdfZavrsena({
      naziv: akcija.naziv,
      vrh: akcija.vrh,
      datum: akcija.datum,
      opis: akcija.opis || '',
      tezina: akcija.tezina || '',
      vodicIme,
      addedBy: akcija.addedBy?.fullName || '',
      brojPrijavljenih: prijave.length,
      brojUspesnoPopeli: uspesnoPopeli.length,
      imenaUspesnoPopeli,
    })
  }

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
        <div className="m-12">
          {/* Vodič i ko je dodao akciju */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl space-y-2">
            {akcija.vodic && (
              <p className="text-gray-700">
                <span className="font-medium text-gray-900">Vodič:</span>{' '}
                {akcija.vodic.fullName} (@{akcija.vodic.username})
              </p>
            )}
            {akcija.drugiVodicIme && (
              <p className="text-gray-700">
                <span className="font-medium text-gray-900">Drugi vodič:</span>{' '}
                {akcija.drugiVodicIme}
              </p>
            )}
            {akcija.addedBy && (
              <p className="text-gray-700">
                <span className="font-medium text-gray-900">Dodao/la akciju:</span>{' '}
                {akcija.addedBy.fullName} (@{akcija.addedBy.username})
              </p>
            )}
          </div>

          {/* Opis akcije vidljiv svima (ulogovanim i neulogovanim) */}
          {akcija.opis && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Opis akcije</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{akcija.opis}</p>
            </div>
          )}

          <h3 className="text-2xl font-semibold mb-4" style={{ color: '#41ac53' }}>
            Prijavljeni članovi ({user ? prijave.length : (akcija.prijaveCount ?? 0)})
          </h3>

          {!user && (
            <p className="mb-6 p-4 bg-gray-50 rounded-xl text-gray-600 text-center">
              <Link to="/" className="text-[#41ac53] font-medium hover:underline">Prijavite se</Link> da vidite ko je prijavljen i da se prijavite na akciju.
            </p>
          )}

          {user && (
            <>
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
                          {(p.korisnik || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{p.korisnik || 'Nepoznat korisnik'}</p>
                          <p className="text-sm text-gray-500">
                            Prijavljen: {formatDateTime(p.prijavljenAt)}
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
                        {user && ['admin', 'vodic'].includes(user?.role) && p.status === 'prijavljen' && !akcija.isCompleted && (
                          <div className="flex gap-2">
                            <button onClick={() => handleUpdateStatus(p.id, 'popeo se')} className="px-4 py-1 sm:px-4 sm:py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm w-9 h-9 sm:w-auto sm:h-auto flex items-center justify-center" title="Popeo se">
                              <span className="sm:hidden">✓</span>
                              <span className="hidden sm:inline">Popeo se</span>
                            </button>
                            <button onClick={() => handleUpdateStatus(p.id, 'nije uspeo')} className="px-4 py-1 sm:px-4 sm:py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm w-9 h-9 sm:w-auto sm:h-auto flex items-center justify-center" title="Nije uspeo">
                              <span className="sm:hidden">✕</span>
                              <span className="hidden sm:inline">Nije uspeo</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
            </div>

            {/* Admin/Vodič – Upravljanje akcijom */}
            {user && ['admin', 'vodic'].includes(user?.role) && (
              <div className="mt-12 mb-10 p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 text-center">Upravljanje akcijom</h4>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center items-stretch sm:items-center">
                  {!akcija.isCompleted && (
                    <>
                      <button
                        onClick={handleZavrsiAkciju}
                        className="group flex items-center justify-center gap-2 px-6 py-3.5 bg-[#41ac53] hover:bg-[#2e8b4a] text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#41ac53]/50 focus:ring-offset-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Završi akciju
                      </button>
                      <button
                        onClick={handleEdit}
                        className="group flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Izmeni akciju
                      </button>
                    </>
                  )}
                  {!akcija.isCompleted ? (
                    <button
                      onClick={handlePrintPrePolaska}
                      className="group flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-500 hover:bg-slate-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2"
                      title="Štampaj formular pre polaska"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Štampaj
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handlePrintPrePolaska}
                        className="group flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-500 hover:bg-slate-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2"
                        title="Štampaj formular pre polaska"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Štampaj – pre polaska
                      </button>
                      <button
                        onClick={handlePrintZavrsena}
                        className="group flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-500 hover:bg-slate-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2"
                        title="Štampaj formular završene akcije"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Štampaj – završena
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleDelete}
                    className="group flex items-center justify-center gap-2 px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Izbriši akciju
                  </button>
                </div>
              </div>
            )}
      </div>

    </div>
  )
}


