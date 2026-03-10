import { useParams, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { generateActionPdfPrePolaska, generateActionPdfZavrsena } from '../../utils/generateActionPdf'
import { formatDateTime, formatDate } from '../../utils/dateUtils'

interface Akcija {
  id: number
  naziv: string
  planina?: string
  vrh: string
  datum: string
  opis: string
  tezina: string
  slikaUrl: string
  createdAt: string
  updatedAt: string
  isCompleted: boolean
  visinaVrhM?: number
  zimskiUspon?: boolean
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 font-medium">Učitavanje akcije...</div>
      </div>
    )
  }
  if (error || !akcija) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center text-red-600 font-medium">{error || 'Akcija nije pronađena'}</div>
      </div>
    )
  }

  const vodicIme = [akcija.vodic?.fullName, akcija.drugiVodicIme].filter(Boolean).join(', ')
  const imenaPolaznika = prijave.map((p) => (p.fullName && p.fullName.trim() ? p.fullName : p.korisnik)).join(', ')
  const uspesnoPopeli = prijave.filter((p) => p.status === 'popeo se')
  const imenaUspesnoPopeli = uspesnoPopeli.map((p) => (p.fullName && p.fullName.trim() ? p.fullName : p.korisnik)).join(', ')

  const handlePrintPrePolaska = () => {
    generateActionPdfPrePolaska({
      naziv: akcija.naziv,
      planina: akcija.planina || '',
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
      planina: akcija.planina || '',
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

  const tezinaLabel = akcija.tezina === 'lako' ? 'Lako' : akcija.tezina === 'srednje' ? 'Srednje' : (akcija.tezina === 'tesko' || akcija.tezina === 'teško') ? 'Teško' : akcija.tezina === 'alpinizam' ? 'Alpinizam' : akcija.tezina || '—'

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Hero */}
      <div className="relative h-72 sm:h-80 md:h-[28rem] overflow-hidden">
        <img
          src={akcija.slikaUrl || 'https://via.placeholder.com/1200x600?text=Akcija'}
          alt={akcija.naziv}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 text-white">
          <div className="max-w-5xl mx-auto w-full">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm">
                {formatDate(akcija.datum)}
              </span>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm">
                {tezinaLabel}
              </span>
              {akcija.zimskiUspon && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-500/80 backdrop-blur-sm">
                  Zimski uspon
                </span>
              )}
              {akcija.isCompleted && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-600/80 backdrop-blur-sm">
                  Završeno
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight drop-shadow-sm">
              {akcija.naziv}
            </h1>
            <p className="mt-2 text-lg sm:text-xl text-white/90">
              {[akcija.planina, akcija.vrh].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200/80 overflow-hidden">
          {/* Info kartice */}
          <div className="p-6 sm:p-8 border-b border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {akcija.planina && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-[#41ac53]/5 border border-[#41ac53]/20">
                  <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#41ac53]/10 flex items-center justify-center text-[#41ac53]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-2a4 4 0 014-4h10a4 4 0 014 4v2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10h10M7 14h6" /></svg>
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Planina</p>
                    <p className="text-gray-900 font-medium mt-0.5">{akcija.planina}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#41ac53]/5 border border-[#41ac53]/20">
                <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#41ac53]/10 flex items-center justify-center text-[#41ac53]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Vrh</p>
                  <p className="text-gray-900 font-medium mt-0.5">{akcija.vrh}</p>
                </div>
              </div>
              {akcija.visinaVrhM != null && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-[#41ac53]/5 border border-[#41ac53]/20">
                  <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#41ac53]/10 flex items-center justify-center text-[#41ac53]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Visina vrha</p>
                    <p className="text-gray-900 font-medium mt-0.5">{akcija.visinaVrhM} m</p>
                  </div>
                </div>
              )}
              {(akcija.vodic || akcija.drugiVodicIme) && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Vodič(i)</p>
                    <p className="text-gray-900 font-medium mt-0.5">{vodicIme}</p>
                  </div>
                </div>
              )}
              {akcija.addedBy && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Postavio/la akciju</p>
                    <p className="text-gray-900 font-medium mt-0.5">
                      {akcija.addedBy.fullName || `@${akcija.addedBy.username}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Opis */}
          {akcija.opis && (
            <div className="p-6 sm:p-8 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Opis akcije</h2>
              <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                {akcija.opis}
              </div>
            </div>
          )}

          {/* Prijavljeni */}
          <div className="p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4" style={{ color: '#41ac53' }}>
              Prijavljeni članovi ({user ? prijave.length : (akcija.prijaveCount ?? 0)})
            </h2>

            {!user && (
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-6 text-center">
                <p className="text-gray-600">
                  <Link to="/" className="text-[#41ac53] font-semibold hover:underline">Prijavite se</Link> da vidite ko je prijavljen i da se prijavite na akciju.
                </p>
              </div>
            )}

            {user && prijave.length === 0 && (
              <p className="text-gray-500 py-4">Još nema prijavljenih članova za ovu akciju.</p>
            )}

            {user && prijave.length > 0 && (
              <ul className="space-y-3">
                {prijave.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-gray-50/80 border border-gray-100 hover:border-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#41ac53] to-[#2e8b4a] flex items-center justify-center text-white font-bold text-lg shrink-0">
                        {(p.fullName && p.fullName.trim() ? p.fullName : p.korisnik || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {p.fullName && p.fullName.trim() ? p.fullName : p.korisnik || 'Nepoznat korisnik'}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Prijavljen: {formatDateTime(p.prijavljenAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-end">
                      <span className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-medium ${
                        p.status === 'popeo se' ? 'bg-emerald-100 text-emerald-800' :
                        p.status === 'nije uspeo' ? 'bg-red-100 text-red-800' :
                        p.status === 'otkazano' ? 'bg-gray-200 text-gray-700' :
                        'bg-[#41ac53]/10 text-[#2e8b4a]'
                      }`}>
                        {p.status}
                      </span>
                      {user && ['superadmin', 'admin', 'vodic'].includes(user?.role) && p.status === 'prijavljen' && !akcija.isCompleted && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateStatus(p.id, 'popeo se')}
                            className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                            title="Popeo se"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(p.id, 'nije uspeo')}
                            className="p-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                            title="Nije uspeo"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Upravljanje akcijom */}
        {user && ['superadmin', 'admin', 'vodic'].includes(user?.role) && (
          <div className="mt-8 p-6 sm:p-8 bg-white rounded-2xl shadow-lg border border-gray-200/80">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 text-center">Upravljanje akcijom</h3>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center items-stretch sm:items-center">
              {!akcija.isCompleted && (
                <>
                  <button
                    onClick={handleZavrsiAkciju}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#41ac53] hover:bg-[#2e8b4a] text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#41ac53]/50 focus:ring-offset-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Završi akciju
                  </button>
                  <button
                    onClick={handleEdit}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    Izmeni akciju
                  </button>
                </>
              )}
              {!akcija.isCompleted ? (
                <button
                  onClick={handlePrintPrePolaska}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-500 hover:bg-slate-600 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2"
                  title="Štampaj formular pre polaska"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Štampaj
                </button>
              ) : (
                <>
                  <button
                    onClick={handlePrintPrePolaska}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-500 hover:bg-slate-600 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2"
                    title="Štampaj formular pre polaska"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Štampaj – pre polaska
                  </button>
                  <button
                    onClick={handlePrintZavrsena}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-500 hover:bg-slate-600 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2"
                    title="Štampaj formular završene akcije"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Štampaj – završena
                  </button>
                </>
              )}
              <button
                onClick={handleDelete}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Izbriši akciju
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


