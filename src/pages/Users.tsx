import { useEffect, useState, useMemo, useRef } from 'react'
import { ChevronDownIcon, Cog6ToothIcon, InformationCircleIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { getRoleLabel, getRoleStyle } from '../utils/roleUtils'
import { Link } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { generateMemberPdf, type MemberPdfData } from '../utils/generateMemberPdf'

interface Korisnik {
  id: number
  username: string
  fullName?: string
  avatar_url?: string
  role: string
  createdAt: string
}

export default function Korisnici() {
  const { user } = useAuth()
  const [korisnici, setKorisnici] = useState<Korisnik[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  const roleDropdownRef = useRef<HTMLDivElement>(null)
  const [avatarFailed, setAvatarFailed] = useState<Record<number, boolean>>({})
  const [printingId, setPrintingId] = useState<number | null>(null)

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
      result = result.filter(k => k.role === roleFilter)
    }

    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase()
      result = result.filter(k =>
        (k.username || '').toLowerCase().includes(lowerSearch) ||
        (k.fullName || '').toLowerCase().includes(lowerSearch)
      )
    }

    return result
  }, [korisnici, searchTerm, roleFilter])

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

  if (loading) return <div className="text-center py-10">Učitavanje korisnika...</div>
  if (error) return <div className="text-center py-10 text-red-600">{error}</div>

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h2 className="text-3xl font-bold" style={{ color: '#41ac53' }}>
          Članovi kluba
        </h2>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:max-w-2xl -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              placeholder="Pretraži po imenu ili username-u..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-[#41ac53] focus:ring-2
               focus:ring-[#41ac53]/30 outline-none transition-all duration-200"
            />
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div ref={roleDropdownRef} className="relative w-full sm:w-auto sm:min-w-[180px]">
            <button
              type="button"
              onClick={() => setRoleDropdownOpen(v => !v)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#41ac53] focus:ring-2
               focus:ring-[#41ac53]/30 outline-none transition-all duration-200 bg-white
               flex items-center justify-between gap-2 text-left"
            >
              <span>{roleOptions.find(o => o.value === roleFilter)?.label ?? 'Sve uloge'}</span>
              <ChevronDownIcon className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {roleDropdownOpen && (
              <div
                className="absolute top-full left-0 right-0 mt-1 py-1 rounded-xl border border-gray-200 bg-white shadow-lg z-50
                 w-full min-w-[120px] sm:min-w-full"
              >
                {roleOptions.map(opt => (
                  <button
                    key={opt.value || '_all'}
                    type="button"
                    onClick={() => {
                      setRoleFilter(opt.value)
                      setRoleDropdownOpen(false)
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 transition-colors first:rounded-t-[10px] last:rounded-b-[10px]
                     ${opt.value === roleFilter ? 'bg-[#41ac53]/10 text-[#41ac53] font-medium' : ''}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {(user?.role === 'admin' || user?.role === 'sekretar') && (
          <Link
            to="/dodaj-korisnika"
            className="px-6 py-3 bg-[#41ac53] text-white rounded-lg font-medium hover:bg-[#3a9a4a] 
            transition-colors whitespace-nowrap"
          >
            Dodaj novog korisnika
          </Link>
        )}
      </div>

      {filteredKorisnici.length === 0 ? (
        <p className="text-gray-600 text-center">
          {searchTerm
            ? `Nema članova za pretragu "${searchTerm}"${roleFilter ? ` sa ulogom ${roleOptions.find(o => o.value === roleFilter)?.label}` : ''}`
            : roleFilter
              ? `Nema članova sa ulogom ${roleOptions.find(o => o.value === roleFilter)?.label}.`
              : 'Još nema registrovanih članova.'}
        </p>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden relative">
          <div className="absolute top-4 right-4 z-10 [&_button]:mb-0">
            <BackButton />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 pt-20">
            {filteredKorisnici.map((k) => (
              <div
                key={k.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden transform transition-all 
                duration-300 hover:shadow-2xl hover:-translate-y-1 border border-gray-100 dark:border-gray-700"
              >
                <div className="p-6">
                  <Link to={`/users/${k.id}`} className="block" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-4">
                      <div className="relative w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-[#41ac53] to-[#2e8b4a] flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
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
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {k.fullName || k.username}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          @{k.username}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Uloga:</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleStyle(k.role)}`}>
                          {getRoleLabel(k.role)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Pridružio se: {new Date(k.createdAt).toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                  </Link>

                  {/* Ikonice: podešavanja, lista (info), štampač */}
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-2">
                    {(user?.role === 'admin' || user?.role === 'sekretar' || user?.username === k.username) && (
                      <Link
                        to={user?.username === k.username ? '/profil/podesavanja' : `/profil/podesavanja/${k.id}`}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
                        title="Podešavanja"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Cog6ToothIcon className="w-5 h-5" />
                      </Link>
                    )}
                    {(user?.role === 'admin' || user?.role === 'sekretar') && (
                      <Link
                        to={`/users/${k.id}/info`}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
                        title="Sve informacije o korisniku"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <InformationCircleIcon className="w-5 h-5" />
                      </Link>
                    )}
                    <button
                      type="button"
                      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Štampanje evidencije člana"
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePrint(k)
                      }}
                      disabled={printingId === k.id}
                    >
                      <PrinterIcon className={`w-5 h-5 ${printingId === k.id ? 'animate-pulse' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}