import { useParams, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
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
  avatarUrl?: string
  prijavljenAt: string
  status: 'prijavljen' | 'popeo se' | 'nije uspeo' | 'otkazano'
}

const TEZINA: Record<string, { bg: string; text: string; label: string }> = {
  lako:      { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Lako' },
  srednje:   { bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'Srednje' },
  tesko:     { bg: 'bg-rose-50',    text: 'text-rose-700',    label: 'Teško' },
  'teško':   { bg: 'bg-rose-50',    text: 'text-rose-700',    label: 'Teško' },
  alpinizam: { bg: 'bg-violet-50',  text: 'text-violet-700',  label: 'Alpinizam' },
}

function tz(t?: string) {
  if (!t) return { bg: 'bg-gray-50', text: 'text-gray-500', label: '—' }
  return TEZINA[t.toLowerCase()] ?? { bg: 'bg-gray-50', text: 'text-gray-500', label: t }
}

const STATUS_STYLE: Record<string, string> = {
  'popeo se':  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'nije uspeo': 'bg-rose-50 text-rose-700 border-rose-200',
  'otkazano':  'bg-gray-100 text-gray-500 border-gray-200',
  'prijavljen': 'bg-emerald-50 text-emerald-600 border-emerald-200',
}

export default function ActionDetails() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { showConfirm, showAlert } = useModal()
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
        setPrijave(res.data.prijave || [])
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

  const handleEdit = () => navigate(`/akcije/${id}/izmeni`)

  const handleUpdateStatus = async (prijavaId: number, newStatus: string) => {
    try {
      await api.post(`/api/prijave/${prijavaId}/status`, { status: newStatus })
      const res = await api.get(`/api/akcije/${id}/prijave`)
      setPrijave(res.data.prijave || [])
    } catch {
      alert('Greška pri ažuriranju statusa')
    }
  }

  const handleZavrsiAkciju = async () => {
    const confirmed = await showConfirm(
      'Posle završavanja akcije više neće biti moguće menjati prijave ili statuse učesnika.',
      {
        title: 'Završi akciju?',
        confirmLabel: 'Završi akciju',
        cancelLabel: 'Otkaži',
      }
    )
    if (!confirmed) return

    try {
      const res = await api.post(`/api/akcije/${id}/zavrsi`)
      await showAlert('Akcija je uspešno završena.', 'Akcija završena')
      const updated = res.data?.akcija
      if (updated) setAkcija(updated)
      else setAkcija((prev) => (prev ? { ...prev, isCompleted: true } : null))
    } catch (err: any) {
      await showAlert(err.response?.data?.error || 'Greška pri završavanju akcije', 'Greška')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    )
  }
  if (error || !akcija) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 font-medium">{error || 'Akcija nije pronađena'}</p>
      </div>
    )
  }

  const vodicIme = [akcija.vodic?.fullName, akcija.drugiVodicIme].filter(Boolean).join(', ')
  const imenaPolaznika = prijave.map((p) => (p.fullName?.trim() ? p.fullName : p.korisnik)).join(', ')
  const uspesnoPopeli = prijave.filter((p) => p.status === 'popeo se')
  const imenaUspesnoPopeli = uspesnoPopeli.map((p) => (p.fullName?.trim() ? p.fullName : p.korisnik)).join(', ')
  const t = tz(akcija.tezina)
  const isAdmin = user && ['superadmin', 'admin', 'vodic'].includes(user.role)

  const handlePrintPrePolaska = () => {
    generateActionPdfPrePolaska({
      naziv: akcija.naziv, planina: akcija.planina || '', vrh: akcija.vrh,
      datum: akcija.datum, opis: akcija.opis || '', tezina: akcija.tezina || '',
      vodicIme, addedBy: akcija.addedBy?.fullName || '',
      brojPolaznika: prijave.length, imenaPolaznika,
    })
  }

  const handlePrintZavrsena = () => {
    generateActionPdfZavrsena({
      naziv: akcija.naziv, planina: akcija.planina || '', vrh: akcija.vrh,
      datum: akcija.datum, opis: akcija.opis || '', tezina: akcija.tezina || '',
      vodicIme, addedBy: akcija.addedBy?.fullName || '',
      brojPrijavljenih: prijave.length, brojUspesnoPopeli: uspesnoPopeli.length,
      imenaUspesnoPopeli,
    })
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 pb-12">

      {/* ══════════ COVER IMAGE ══════════ */}
      <div className="relative h-56 sm:h-64 md:h-72 lg:h-80 overflow-hidden -mt-6 w-screen left-1/2 -translate-x-1/2">
        <img
          src={akcija.slikaUrl || 'https://via.placeholder.com/1200x600?text=Akcija'}
          alt={akcija.naziv}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-white bg-white/20 backdrop-blur-md">
                {formatDate(akcija.datum)}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${t.bg} ${t.text}`}>
                {t.label}
              </span>
              {akcija.zimskiUspon && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-sky-500/80 text-white backdrop-blur-sm">
                  Zimski uspon
                </span>
              )}
              {akcija.isCompleted && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-500/80 text-white backdrop-blur-sm">
                  Završena
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-sm leading-tight">
              {akcija.naziv}
            </h1>
            <p className="mt-1 text-sm sm:text-base text-white/80 font-medium">
              {[akcija.planina, akcija.vrh].filter(Boolean).join(' · ')}
              {akcija.visinaVrhM != null && ` · ${akcija.visinaVrhM} m`}
            </p>
          </div>
        </div>
      </div>

      {/* ══════════ STATS BAR ══════════ */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
            {akcija.planina && (
              <div className="flex flex-col items-center py-4">
                <span className="text-sm sm:text-base font-extrabold text-gray-900 leading-none">{akcija.planina}</span>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">Planina</p>
              </div>
            )}
            <div className="flex flex-col items-center py-4">
              <span className="text-sm sm:text-base font-extrabold text-gray-900 leading-none">{akcija.vrh}</span>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">Vrh</p>
            </div>
            {akcija.visinaVrhM != null && (
              <div className="flex flex-col items-center py-4">
                <span className="text-sm sm:text-base font-extrabold text-gray-900 leading-none">
                  {akcija.visinaVrhM} <span className="text-xs font-semibold text-emerald-500">m</span>
                </span>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">Visina</p>
              </div>
            )}
            <div className="flex flex-col items-center py-4">
              <span className="text-sm sm:text-base font-extrabold text-gray-900 leading-none">
                {user ? prijave.length : (akcija.prijaveCount ?? 0)}
              </span>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">Prijavljenih</p>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ BODY ══════════ */}
      <div className="bg-gray-50/80 min-h-[40vh]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">

          {/* Detalji */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 space-y-5">
              {/* Vodič i kreator */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(akcija.vodic || akcija.drugiVodicIme) && (
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <svg className="w-4.5 h-4.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Vodič(i)</p>
                      <p className="text-sm font-semibold text-gray-900">{vodicIme}</p>
                    </div>
                  </div>
                )}
                {akcija.addedBy && (
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 h-9 w-9 rounded-xl bg-gray-50 flex items-center justify-center">
                      <svg className="w-4.5 h-4.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Postavio/la</p>
                      <p className="text-sm font-semibold text-gray-900">{akcija.addedBy.fullName || `@${akcija.addedBy.username}`}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Opis */}
              {akcija.opis && (
                <div className="pt-4 border-t border-gray-50">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Opis akcije</h2>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{akcija.opis}</p>
                </div>
              )}
            </div>
          </div>

          {/* ══════════ PRIJAVLJENI ČLANOVI ══════════ */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">Prijavljeni članovi</h2>
                <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                  {user ? prijave.length : (akcija.prijaveCount ?? 0)}
                </span>
              </div>

              {!user && (
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-6 text-center">
                  <p className="text-sm text-gray-500">
                    <Link to="/login" className="text-emerald-600 font-semibold hover:underline">Prijavite se</Link> da vidite ko je prijavljen.
                  </p>
                </div>
              )}

              {user && prijave.length === 0 && (
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-8 text-center">
                  <p className="text-sm text-gray-400">Još nema prijavljenih članova za ovu akciju.</p>
                </div>
              )}

              {user && prijave.length > 0 && (
                <div className="space-y-2">
                  {prijave.map((p) => {
                    const displayName = p.fullName?.trim() ? p.fullName : p.korisnik || 'Nepoznat'
                    const initial = displayName.charAt(0).toUpperCase()
                    const statusCls = STATUS_STYLE[p.status] || 'bg-gray-100 text-gray-500 border-gray-200'

                    return (
                      <div
                        key={p.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-gray-50/60 border border-gray-100 hover:border-emerald-100 hover:bg-emerald-50/30 transition-all"
                      >
                        <Link
                          to={`/korisnik/${p.korisnik}`}
                          className="flex items-center gap-3 min-w-0 hover:no-underline group"
                        >
                          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white shadow-sm flex-shrink-0">
                            {p.avatarUrl ? (
                              <img src={p.avatarUrl} alt={displayName} className="absolute inset-0 w-full h-full object-cover" />
                            ) : null}
                            <span className={p.avatarUrl ? 'invisible' : ''}>{initial}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">
                              {displayName}
                            </p>
                            <p className="text-[11px] text-gray-400 font-medium">
                              @{p.korisnik} · {formatDateTime(p.prijavljenAt)}
                            </p>
                          </div>
                        </Link>

                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusCls}`}>
                            {p.status}
                          </span>
                          {isAdmin && p.status === 'prijavljen' && !akcija.isCompleted && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'popeo se')}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
                                title="Popeo se"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'nije uspeo')}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-sm"
                                title="Nije uspeo"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ══════════ ADMIN CONTROLS ══════════ */}
          {isAdmin && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4 text-center">Upravljanje akcijom</h3>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-center">
                {!akcija.isCompleted && (
                  <>
                    <button
                      onClick={handleZavrsiAkciju}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      Završi akciju
                    </button>
                    <button
                      onClick={handleEdit}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      Izmeni
                    </button>
                  </>
                )}
                {!akcija.isCompleted ? (
                  <button
                    onClick={handlePrintPrePolaska}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Štampaj
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handlePrintPrePolaska}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      Štampaj – pre polaska
                    </button>
                    <button
                      onClick={handlePrintZavrsena}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      Štampaj – završena
                    </button>
                  </>
                )}
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Izbriši
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
