import { useEffect, useState, useMemo, useRef } from 'react'
import { ChevronDownIcon, Cog6ToothIcon, InformationCircleIcon, PrinterIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../../context/AuthContext'
import { useModal } from '../../../context/ModalContext'
import api from '../../../services/api'
import { getRoleLabel, getRoleStyle } from '../../../utils/roleUtils'
import { Link } from 'react-router-dom'
import { generateMemberPdf, type MemberPdfData } from '../../../utils/generateMemberPdf'
import { formatDate } from '../../../utils/dateUtils'
import Loader from '../../../components/Loader'
import { computeRank, formatRankDisplayName } from '../../../utils/rankingUtils'

interface Korisnik {
  id: number
  username: string
  fullName?: string
  avatar_url?: string
  role: string
  createdAt: string
  ukupnoKm?: number
  ukupnoMetaraUspona?: number
  klubNaziv?: string
  klubLogoUrl?: string
}

export default function Korisnici() {
  const { user } = useAuth()
  const { showConfirm, showAlert } = useModal()
  const [korisnici, setKorisnici] = useState<Korisnik[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  const roleDropdownRef = useRef<HTMLDivElement>(null)
  const [avatarFailed, setAvatarFailed] = useState<Record<number, boolean>>({})
  const [printingId, setPrintingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'rank'>('all')

  useEffect(() => {
    if (!user) return

    const fetchKorisnici = async () => {
      try {
        const res = await api.get('/api/korisnici')
        setKorisnici(res.data.korisnici || [])
      } catch (err: any) {
        setError(err.response?.data?.error || 'Greška pri učitavanju korisnika')
      } finally {
        setLoading(false)
      }
    }

    fetchKorisnici()
  }, [user])

  
  const roleOptions: { value: string; label: string }[] = [
    { value: '', label: 'Sve uloge' },
    { value: 'clan', label: 'Član' },
    { value: 'vodic', label: 'Vodič' },
    { value: 'blagajnik', label: 'Blagajnik' },
    { value: 'sekretar', label: 'Sekretar' },
    { value: 'menadzer-opreme', label: 'Menadžer opreme' },
    { value: 'admin', label: 'Admin' },
  ]

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setRoleDropdownOpen(false)
      }
    }
    if (roleDropdownOpen) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [roleDropdownOpen])

  const filteredKorisnici = useMemo(() => {
    let result = korisnici

    if (roleFilter) {
      result = result.filter((k) => k.role === roleFilter)
    }

    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase()
      result = result.filter(
        (k) =>
          (k.username || '').toLowerCase().includes(lowerSearch) ||
          (k.fullName || '').toLowerCase().includes(lowerSearch)
      )
    }

    return result
  }, [korisnici, searchTerm, roleFilter])

  // Globalni ranking za ceo klub (bez filtera) – da pozicija (1., 56., ...) ostane ista
  const globalRanking = useMemo(
    () =>
      korisnici
        .map((k) => {
                  const rank = computeRank({
                    ukupnoKm: k.ukupnoKm ?? 0,
                    ukupnoMetaraUspona: k.ukupnoMetaraUspona ?? 0,
                  })
                  return { ...k, rank }
        })
        .sort((a, b) => b.rank.mmr - a.rank.mmr),
    [korisnici]
  )

  // Globalna pozicija po korisniku (id -> 1,2,3...)
  const globalPositionByUserId = useMemo(() => {
    const map: Record<number, number> = {}
    globalRanking.forEach((k, i) => {
      map[k.id] = i + 1
    })
    return map
  }, [globalRanking])

  // Rang lista za prikaz – po filtriranim korisnicima, ali sa globalnom pozicijom
  const rankingKorisnici = useMemo(
    () =>
      filteredKorisnici
        .map((k) => {
          const rank = computeRank({
            ukupnoKm: k.ukupnoKm ?? 0,
            ukupnoMetaraUspona: k.ukupnoMetaraUspona ?? 0,
          })
          return { ...k, rank, globalPosition: globalPositionByUserId[k.id] }
        })
        .sort((a, b) => b.rank.mmr - a.rank.mmr),
    [filteredKorisnici, globalPositionByUserId]
  )

  const handleDelete = async (k: Korisnik) => {
    if (deletingId) return
    const ok = await showConfirm(
      `Da li ste sigurni da želite da trajno obrišete korisnika ${k.fullName || k.username}? Ovaj korak se ne može poništiti.`,
      { variant: 'danger', confirmLabel: 'Obriši' }
    )
    if (!ok) return
    setDeletingId(k.id)
    try {
      await api.delete(`/api/korisnici/${k.id}`)
      setKorisnici((prev) => prev.filter((u) => u.id !== k.id))
      await showAlert('Korisnik je obrisan.')
    } catch (err: any) {
      await showAlert(err.response?.data?.error || 'Greška pri brisanju korisnika.', 'Greška')
    } finally {
      setDeletingId(null)
    }
  }

  const handlePrint = async (k: Korisnik) => {
    if (printingId) return
    setPrintingId(k.id)
    try {
      const res = await api.get(`/api/korisnici/${k.id}`)
      const data = res.data as Record<string, unknown>
      const pdfData: MemberPdfData = {
        clubName: undefined,
        fullName: (data.fullName as string) || k.username,
        ime_roditelja: data.ime_roditelja as string | undefined,
        pol: data.pol as string | undefined,
        datum_rodjenja: data.datum_rodjenja as string | null | undefined,
        drzavljanstvo: data.drzavljanstvo as string | undefined,
        adresa: data.adresa as string | undefined,
        telefon: data.telefon as string | undefined,
        email: data.email as string | undefined,
        datum_uclanjenja: data.datum_uclanjenja as string | null | undefined,
        broj_licnog_dokumenta: data.broj_licnog_dokumenta as string | undefined,
        broj_planinarske_legitimacije: data.broj_planinarske_legitimacije as string | undefined,
        broj_planinarske_markice: data.broj_planinarske_markice as string | undefined,
        izrecene_disciplinske_kazne: data.izrecene_disciplinske_kazne as string | undefined,
        izbor_u_organe_sportskog_udruzenja: data.izbor_u_organe_sportskog_udruzenja as string | undefined,
        napomene: data.napomene as string | undefined,
      }
      generateMemberPdf(pdfData)
    } catch (err: unknown) {
      console.error('Greška pri generisanju PDF-a:', err)
    } finally {
      setPrintingId(null)
    }
  }

  if (loading) return <Loader />
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-rose-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 font-medium">{error}</p>
      </div>
    )
  }

  return (
    <div className="pb-16 md:pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-8 space-y-6 sm:space-y-8">

        {/* ══════════ PAGE HEADER ══════════ */}
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">
                Članovi kluba
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 ml-3.5 max-w-xl">
              Pregled svih članova, uloga i ranga u klubu.
            </p>
          </div>

          {(user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'sekretar') && (
            <div className="flex-shrink-0">
              <Link
                to="/dodaj-korisnika"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/60 transition-all whitespace-nowrap"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Dodaj novog korisnika
              </Link>
            </div>
          )}
        </div>

        {/* ══════════ FILTER BAR ══════════ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3.5 py-3.5 sm:px-4 sm:py-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
            {/* Search */}
            <div className="flex-1 min-w-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Pretraži po imenu ili username-u..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 sm:pl-10 sm:pr-4 py-2.5 sm:py-3 rounded-xl border border-gray-200 bg-gray-50/60 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/25 focus:bg-white outline-none transition-all"
                />
                <svg className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Role filter */}
            <div ref={roleDropdownRef} className="relative w-full sm:w-52 lg:w-60">
              <button
                type="button"
                onClick={() => setRoleDropdownOpen((v) => !v)}
                className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-gray-200 bg-gray-50/60 text-sm text-gray-700 flex items-center justify-between gap-2 outline-none transition-all hover:border-emerald-300 hover:bg-emerald-50/40 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/25"
              >
                <span className="truncate">
                  {roleOptions.find((o) => o.value === roleFilter)?.label ?? 'Sve uloge'}
                </span>
                <ChevronDownIcon className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-500 shrink-0 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {roleDropdownOpen && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 py-1 rounded-xl border border-gray-200 bg-white shadow-lg z-50 w-full min-w-[160px]"
                >
                  {roleOptions.map((opt) => (
                    <button
                      key={opt.value || '_all'}
                      type="button"
                      onClick={() => {
                        setRoleFilter(opt.value)
                        setRoleDropdownOpen(false)
                      }}
                      className={`w-full px-3.5 py-2 text-left text-sm hover:bg-gray-50 transition-colors first:rounded-t-[10px] last:rounded-b-[10px] ${
                        opt.value === roleFilter ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══════════ TABS ══════════ */}
        <div className="border-b border-gray-100">
          <nav className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`pb-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'all'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Svi članovi
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rank')}
              className={`pb-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'rank'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Rang lista (Top 30)
            </button>
          </nav>
        </div>

        {/* ══════════ CONTENT ══════════ */}
        {activeTab === 'all' ? (
          filteredKorisnici.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 sm:p-12 text-center max-w-xl mx-auto">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 mb-3">
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5l7.5 3 4.5-1.5m-12-1.5L3 16.5l7.5 3 7.5-3-1.875-6.75M3 7.5L12 4l6.75 2.25" />
                </svg>
              </div>
              <p className="text-sm text-gray-600 font-medium">
                {searchTerm
                  ? `Nema članova za pretragu "${searchTerm}"${
                      roleFilter ? ` sa ulogom ${roleOptions.find((o) => o.value === roleFilter)?.label}` : ''
                    }`
                  : roleFilter
                    ? `Nema članova sa ulogom ${roleOptions.find((o) => o.value === roleFilter)?.label}.`
                    : 'Još nema registrovanih članova.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 p-4 sm:p-5 md:p-6">
                {filteredKorisnici.map((k) => {
                  const rank = computeRank({
                    ukupnoKm: k.ukupnoKm ?? 0,
                    ukupnoMetaraUspona: k.ukupnoMetaraUspona ?? 0,
                  })

                  return (
                    <div
                      key={k.id}
                      className="group bg-gradient-to-b from-gray-50/90 via-white to-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                    >
                      <div className="p-5 md:p-6">
                        <Link to={`/korisnik/${k.username}`} className="block" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm ring-2 ring-white">
                                {k.avatar_url && !avatarFailed[k.id] ? (
                                  <img
                                    src={k.avatar_url}
                                    alt={k.fullName || k.username || ''}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    onError={() => setAvatarFailed((prev) => ({ ...prev, [k.id]: true }))}
                                  />
                                ) : null}
                                <span className={k.avatar_url && !avatarFailed[k.id] ? 'invisible' : ''}>
                                  {(k.fullName || k.username || '?').charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <h3 className="text-base md:text-lg font-semibold text-gray-900">
                                  {k.fullName || k.username}
                                </h3>
                                <p className="text-sm text-gray-500">
                                  @{k.username}
                                </p>
                              </div>
                            </div>
                            <div
                              className="hidden sm:inline-flex flex-col items-end rounded-2xl px-3 py-1.5 text-right bg-white/80 border border-gray-100"
                            >
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-900">
                                {formatRankDisplayName(rank, globalPositionByUserId[k.id])}
                              </span>
                              <span className="text-[10px] text-gray-600">
                                MMR {rank.mmr}
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-700">Uloga:</span>
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${getRoleStyle(k.role)}`}>
                                  {getRoleLabel(k.role)}
                                </span>
                              </div>
                              <div
                                className="sm:hidden inline-flex flex-col items-end rounded-xl px-2.5 py-1 text-right bg-gray-50"
                                style={{ borderLeft: `3px solid ${rank.boja}` }}
                              >
                                <span className="text-[11px] font-semibold text-gray-800">
                                  {formatRankDisplayName(rank, globalPositionByUserId[k.id])}
                                </span>
                                <span className="text-[10px] text-gray-500">
                                  MMR {rank.mmr}
                                </span>
                              </div>
                            </div>
                            {k.klubNaziv && (
                              <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500">
                                {k.klubLogoUrl ? (
                                  <img src={k.klubLogoUrl} alt="" className="w-4 h-4 rounded-sm object-cover" />
                                ) : (
                                  <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                                  </svg>
                                )}
                                <span className="text-violet-600 font-medium">{k.klubNaziv}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>
                                Pridružio se: {formatDate(k.createdAt)}
                              </span>
                            </div>
                          </div>
                        </Link>

                        {(user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'sekretar') && (
                          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-end gap-1.5 sm:gap-2">
                            <Link
                              to={user?.username === k.username ? '/profil/podesavanja' : `/profil/podesavanja/${k.id}`}
                              className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                              title="Podešavanja"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Cog6ToothIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Link>
                            <Link
                              to={`/users/${k.id}/info`}
                              className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                              title="Sve informacije o korisniku"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <InformationCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Link>
                            <button
                              type="button"
                              className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Štampanje evidencije člana"
                              onClick={(e) => {
                                e.stopPropagation()
                                handlePrint(k)
                              }}
                              disabled={printingId === k.id}
                            >
                              <PrinterIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${printingId === k.id ? 'animate-pulse' : ''}`} />
                            </button>
                            {user?.username !== k.username && (
                              <button
                                type="button"
                                className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Obriši korisnika"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(k)
                                }}
                                disabled={deletingId === k.id}
                              >
                                <TrashIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${deletingId === k.id ? 'animate-pulse' : ''}`} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        ) : (
          <section className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  Ukupna rang lista članova
                </h3>
              </div>
              <span className="rounded-full bg-gray-50 px-3 py-1 text-[11px] font-medium text-gray-600">
                {rankingKorisnici.length} članova
              </span>
            </div>
            {rankingKorisnici.length === 0 ? (
              <p className="text-sm text-gray-600">
                Još nema dovoljno podataka za rang listu.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {rankingKorisnici.map((k, index) => (
                  <li
                    key={k.id}
                    className="flex items-center gap-3 py-3 sm:py-3.5 bg-white"
                  >
                    <span className="w-7 text-sm font-semibold text-gray-500 text-right">
                      {index + 1}.
                    </span>
                    <Link
                      to={`/korisnik/${k.username}`}
                      className="flex flex-1 items-center gap-3 sm:gap-4 hover:no-underline"
                    >
                      <div className="relative h-10 w-10 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold text-lg">
                        {k.avatar_url && !avatarFailed[k.id] ? (
                          <img
                            src={k.avatar_url}
                            alt={k.fullName || k.username || ''}
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={() =>
                              setAvatarFailed((prev) => ({ ...prev, [k.id]: true }))
                            }
                          />
                        ) : null}
                        <span
                          className={
                            k.avatar_url && !avatarFailed[k.id] ? 'invisible' : ''
                          }
                        >
                          {(k.fullName || k.username || '?')
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {k.fullName || k.username}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          @{k.username}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-700">
                          {formatRankDisplayName(k.rank, globalPositionByUserId[k.id])}
                        </span>
                        <span className="text-xs font-semibold text-gray-800">
                          {k.rank.mmr} MMR
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  )
}