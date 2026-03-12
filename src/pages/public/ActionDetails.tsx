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
  'popeo se':   'bg-emerald-50 text-emerald-700 border-emerald-200',
  'nije uspeo': 'bg-rose-50 text-rose-700 border-rose-200',
  'otkazano':   'bg-gray-100 text-gray-500 border-gray-200',
  'prijavljen': 'bg-emerald-50 text-emerald-600 border-emerald-200',
}

const STATUS_LABEL: Record<string, string> = {
  'popeo se':   'Popeo se',
  'nije uspeo': 'Nije uspeo',
  'otkazano':   'Otkazano',
  'prijavljen': 'Prijavljen',
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
  const memberCount = user ? prijave.length : (akcija.prijaveCount ?? 0)

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
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 pb-16 md:pb-10">

      {/* ══════════ COVER IMAGE ══════════ */}
      <div className="relative h-64 sm:h-72 md:h-80 lg:h-[22rem] overflow-hidden -mt-6 w-screen left-1/2 -translate-x-1/2">
        <img
          src={akcija.slikaUrl || 'https://via.placeholder.com/1200x600?text=Akcija'}
          alt={akcija.naziv}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 sm:top-5 sm:left-6 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-white bg-black/30 hover:bg-black/50 backdrop-blur-md border border-white/10 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Nazad
        </button>

        {/* Cover content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white bg-white/20 backdrop-blur-md border border-white/10">
                {formatDate(akcija.datum)}
              </span>
              <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${t.bg} ${t.text}`}>
                {t.label}
              </span>
              {akcija.zimskiUspon && (
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-sky-500/80 text-white backdrop-blur-sm border border-sky-400/30">
                  Zimski uspon
                </span>
              )}
              {akcija.isCompleted && (
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm border border-white/10">
                  Završena
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-lg leading-tight max-w-3xl">
              {akcija.naziv}
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-white/80 font-medium flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-white/50 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
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
              <StatCell
                icon={<svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6v12.75c0 1.243 1.007 2.25 2.25 2.25z" /></svg>}
                value={akcija.planina}
                label="Planina"
              />
            )}
            <StatCell
              icon={<svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" /></svg>}
              value={akcija.vrh}
              label="Vrh"
            />
            {akcija.visinaVrhM != null && (
              <StatCell
                icon={<svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>}
                value={`${akcija.visinaVrhM}`}
                unit="m"
                label="Visina"
              />
            )}
            <StatCell
              icon={<svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
              value={String(memberCount)}
              label="Prijavljenih"
            />
          </div>
        </div>
      </div>

      {/* ══════════ BODY ══════════ */}
      <div className="bg-gray-50/80 min-h-[40vh]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">

          {/* ── Info grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left: Details */}
            <div className="lg:col-span-2 space-y-6">

              {/* Vodič / Kreator card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                  <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">Detalji akcije</h2>
                </div>
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(akcija.vodic || akcija.drugiVodicIme) && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                        }
                        iconBg="bg-emerald-50"
                        label="Vodič(i)"
                        value={vodicIme}
                      />
                    )}
                    {akcija.addedBy && (
                      <InfoRow
                        icon={
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        }
                        iconBg="bg-gray-50"
                        label="Postavio/la"
                        value={akcija.addedBy.fullName || `@${akcija.addedBy.username}`}
                      />
                    )}
                    <InfoRow
                      icon={
                        <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                      }
                      iconBg="bg-sky-50"
                      label="Datum"
                      value={formatDate(akcija.datum)}
                    />
                    <InfoRow
                      icon={
                        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                      }
                      iconBg="bg-amber-50"
                      label="Težina"
                      value={t.label}
                    />
                  </div>

                  {akcija.opis && (
                    <div className="pt-4 border-t border-gray-50">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Opis akcije</h3>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{akcija.opis}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Prijavljeni članovi ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                    <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">Prijavljeni članovi</h2>
                  </div>
                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                    {memberCount}
                  </span>
                </div>

                <div className="p-5 sm:p-6">
                  {!user && (
                    <div className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-100 p-8 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-100 mb-3">
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500">
                        <Link to="/login" className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors">Prijavite se</Link> da vidite ko je prijavljen.
                      </p>
                    </div>
                  )}

                  {user && prijave.length === 0 && (
                    <div className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-100 p-8 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-100 mb-3">
                        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                      </div>
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
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-gray-50/60 border border-gray-100 hover:border-emerald-200/60 hover:bg-emerald-50/20 transition-all duration-200"
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
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${statusCls}`}>
                                {STATUS_LABEL[p.status] || p.status}
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
            </div>

            {/* Right: sidebar */}
            <div className="space-y-6">

              {/* Status card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight">Status</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    {akcija.isCompleted ? (
                      <>
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Završena</p>
                          <p className="text-[11px] text-gray-400">Akcija je uspešno završena</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Aktivna</p>
                          <p className="text-[11px] text-gray-400">Prijave su otvorene</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Quick stats in sidebar */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50/80 border border-gray-100">
                      <span className="text-[11px] text-gray-500 font-medium">Prijavljenih</span>
                      <span className="text-sm font-bold text-gray-900">{memberCount}</span>
                    </div>
                    {akcija.isCompleted && user && (
                      <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-emerald-50/80 border border-emerald-100">
                        <span className="text-[11px] text-emerald-600 font-medium">Popeli se</span>
                        <span className="text-sm font-bold text-emerald-700">{uspesnoPopeli.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ══════════ ADMIN CONTROLS ══════════ */}
              {isAdmin && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
                    <div className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
                    <h3 className="text-sm font-bold text-gray-900 tracking-tight">Upravljanje</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {!akcija.isCompleted && (
                      <>
                        <button
                          onClick={handleZavrsiAkciju}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/50 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          Završi akciju
                        </button>
                        <button
                          onClick={handleEdit}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          Izmeni akciju
                        </button>
                      </>
                    )}

                    <div className={`${!akcija.isCompleted ? 'pt-2 mt-2 border-t border-gray-100' : ''} space-y-2`}>
                      {!akcija.isCompleted ? (
                        <button
                          onClick={handlePrintPrePolaska}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                          Štampaj PDF
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handlePrintPrePolaska}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            Štampaj – pre polaska
                          </button>
                          <button
                            onClick={handlePrintZavrsena}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            Štampaj – završena
                          </button>
                        </>
                      )}
                    </div>

                    <div className="pt-2 mt-2 border-t border-gray-100">
                      <button
                        onClick={handleDelete}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Izbriši akciju
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════ */

function StatCell({ icon, value, unit, label }: { icon: React.ReactNode; value: string; unit?: string; label: string }) {
  return (
    <div className="flex flex-col items-center py-4 gap-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-sm sm:text-base font-extrabold text-gray-900 leading-none">
          {value}
          {unit && <span className="text-xs font-semibold text-emerald-500 ml-0.5">{unit}</span>}
        </span>
      </div>
      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
    </div>
  )
}

function InfoRow({ icon, iconBg, label, value }: { icon: React.ReactNode; iconBg: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`shrink-0 h-9 w-9 rounded-xl ${iconBg} flex items-center justify-center`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  )
}
