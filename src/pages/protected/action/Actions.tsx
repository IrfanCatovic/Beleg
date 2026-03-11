import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { useModal } from '../../../context/ModalContext'
import api from '../../../services/api'
import { formatDateShort } from '../../../utils/dateUtils'
import { generateAnnualReportPdf } from '../../../utils/generateAnnualReportPdf'
import {
  computeCountsForParticipants,
  type AnnualReportRow,
  type ParticipantForReport,
} from '../../../utils/annualReportUtils'
import Loader from '../../../components/Loader'
import Dropdown from '../../../components/Dropdown'
import { computeMMRForAkcija, type AkcijaZaRanking } from '../../../utils/rankingUtils'

interface Akcija {
  id: number
  naziv: string
  planina?: string
  vrh: string
  datum: string
  opis?: string
  tezina?: string
  visinaVrhM?: number
  zimskiUspon?: boolean
  slikaUrl?: string
  isCompleted: boolean
  uIstorijiKluba?: boolean
  duzinaStazeKm?: number
  kumulativniUsponM?: number
}

const TEZINA_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  lako:      { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Lako' },
  srednje:   { bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'Srednje' },
  tesko:     { bg: 'bg-rose-50',    text: 'text-rose-700',    label: 'Teško' },
  'teško':   { bg: 'bg-rose-50',    text: 'text-rose-700',    label: 'Teško' },
  alpinizam: { bg: 'bg-violet-50',  text: 'text-violet-700',  label: 'Alpinizam' },
}

function tezinaStyle(t?: string) {
  if (!t) return { bg: 'bg-gray-50', text: 'text-gray-500', label: 'Nepoznato' }
  return TEZINA_STYLE[t.toLowerCase()] ?? { bg: 'bg-gray-50', text: 'text-gray-500', label: t }
}

export default function Actions() {
  const { isLoggedIn, user } = useAuth()
  const { showAlert, showConfirm } = useModal()
  const [aktivneAkcije, setAktivneAkcije] = useState<Akcija[]>([])
  const [zavrseneAkcije, setZavrseneAkcije] = useState<Akcija[]>([])
  const [prijavljeneAkcije, setPrijavljeneAkcije] = useState<Set<number>>(new Set())
  const [otkaziveAkcije, setOtkaziveAkcije] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAnnualReportModal, setShowAnnualReportModal] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number | ''>('')
  const [loadingReport, setLoadingReport] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const akcijeRes = await api.get('/api/akcije')
        const uIstoriji = (a: Akcija) => a.uIstorijiKluba !== false
        setAktivneAkcije((akcijeRes.data.aktivne || []).filter(uIstoriji))
        setZavrseneAkcije((akcijeRes.data.zavrsene || []).filter(uIstoriji))

        const mojeRes = await api.get('/api/moje-prijave')
        const ids = mojeRes.data.prijavljeneAkcije || []
        const otkaziveIds = mojeRes.data.otkaziveAkcije || []
        setPrijavljeneAkcije(new Set(ids))
        setOtkaziveAkcije(new Set(otkaziveIds))
      } catch (err: any) {
        setError(err.response?.data?.error || 'Greška pri učitavanju podataka')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isLoggedIn])

  const yearsWithCompleted = useMemo(() => {
    const years = new Set<number>()
    zavrseneAkcije.forEach((a) => {
      if (a.datum) {
        const y = new Date(a.datum).getFullYear()
        if (!isNaN(y)) years.add(y)
      }
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [zavrseneAkcije])

  const handleOpenAnnualReport = () => {
    if (zavrseneAkcije.length === 0) {
      showAlert('Nema završenih akcija. Godišnji izveštaj se pravi samo za godine u kojima ima završenih akcija.')
      return
    }
    setSelectedYear(yearsWithCompleted[0] ?? '')
    setShowAnnualReportModal(true)
  }

  const handleGenerateAnnualReportPdf = async () => {
    if (selectedYear === '') {
      await showAlert('Izaberite godinu.')
      return
    }
    setLoadingReport(true)
    try {
      const actionsInYear = zavrseneAkcije.filter((a) => {
        if (!a.datum) return false
        if (a.uIstorijiKluba === false) return false
        const y = new Date(a.datum).getFullYear()
        return !isNaN(y) && y === selectedYear
      })
      if (actionsInYear.length === 0) {
        await showAlert(`Nema završenih akcija za ${selectedYear}. godinu.`)
        setLoadingReport(false)
        return
      }
      const sorted = [...actionsInYear].sort(
        (a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime()
      )

      const korisniciRes = await api.get('/api/korisnici')
      const korisniciList = korisniciRes.data.korisnici || []
      const usernameToId: Record<string, number> = {}
      korisniciList.forEach((k: { id: number; username: string }) => {
        if (k.username) usernameToId[k.username] = k.id
      })

      const userCache: Record<number, { datum_rodjenja?: string | null; pol?: string }> = {}
      const getUser = async (userId: number) => {
        if (userCache[userId]) return userCache[userId]
        try {
          const res = await api.get(`/api/korisnici/${userId}`)
          const u = res.data
          userCache[userId] = {
            datum_rodjenja: u.datum_rodjenja ?? null,
            pol: u.pol,
          }
          return userCache[userId]
        } catch {
          return {}
        }
      }

      const rows: AnnualReportRow[] = []
      for (let i = 0; i < sorted.length; i++) {
        const akcija = sorted[i]
        const nazivIMesto = [akcija.naziv, akcija.planina, akcija.vrh].filter(Boolean).join(', ')
        let prijave: Array<{
          korisnik: string
          userId?: number
          status: string
          datum_rodjenja?: string | null
          pol?: string
        }> = []
        try {
          const res = await api.get(`/api/akcije/${akcija.id}/prijave`)
          prijave = res.data.prijave || []
        } catch {
          // skip
        }
        const uspesnoPopeli = prijave.filter((p: { status: string }) => p.status === 'popeo se')
        const participants: ParticipantForReport[] = []
        for (const p of uspesnoPopeli) {
          const userId = p.userId ?? usernameToId[p.korisnik]
          if (userId != null) {
            const u = await getUser(userId)
            participants.push({
              datum_rodjenja: p.datum_rodjenja ?? u.datum_rodjenja,
              pol: p.pol ?? u.pol,
            })
          } else if (p.datum_rodjenja != null || p.pol != null) {
            participants.push({
              datum_rodjenja: p.datum_rodjenja,
              pol: p.pol,
            })
          }
        }
        const counts = computeCountsForParticipants(participants, akcija.datum)
        rows.push({
          rb: i + 1,
          nazivIMesto,
          datum: akcija.datum,
          counts,
        })
      }
      generateAnnualReportPdf(rows)
      setShowAnnualReportModal(false)
    } catch (err: unknown) {
      console.error(err)
      await showAlert('Greška pri pripremi podataka za godišnji izveštaj. Proverite da li backend u prijavama vraća userId (ili datum_rodjenja i pol) za učesnike.')
    } finally {
      setLoadingReport(false)
    }
  }

  const handlePrijavi = async (akcijaId: number, naziv: string) => {
    const confirmed = await showConfirm(`Da li želite da se prijavite za "${naziv}"?`)
    if (!confirmed) return

    try {
      const response = await api.post(`/api/akcije/${akcijaId}/prijavi`)
      await showAlert(response.data.message)

      setPrijavljeneAkcije(prev => new Set([...prev, akcijaId]))
      setOtkaziveAkcije(prev => new Set([...prev, akcijaId]))
    } catch (err: any) {
      const errMsg = err.response?.data?.error
      await showAlert(typeof errMsg === 'string' ? errMsg : 'Greška pri prijavi')
      if (typeof errMsg === 'string' && errMsg.includes('Već ste prijavljeni')) {
        setPrijavljeneAkcije(prev => new Set([...prev, akcijaId]))
        setOtkaziveAkcije(prev => new Set([...prev, akcijaId]))
      }
    }
  }

  const handleOtkaziPrijavu = async (akcijaId: number, naziv: string) => {
    const confirmed = await showConfirm(`Da li zaista želiš da otkažeš prijavu za "${naziv}"?`)
    if (!confirmed) return

    try {
      await api.delete(`/api/akcije/${akcijaId}/prijavi`)
      await showAlert('Uspešno ste otkazali prijavu!')

      setPrijavljeneAkcije(prev => {
        const newSet = new Set(prev)
        newSet.delete(akcijaId)
        return newSet
      })
      setOtkaziveAkcije(prev => {
        const newSet = new Set(prev)
        newSet.delete(akcijaId)
        return newSet
      })
    } catch (err: any) {
      await showAlert(err.response?.data?.error || 'Greška pri otkazivanju prijave')
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 font-medium">Morate se ulogovati da biste videli akcije.</p>
      </div>
    )
  }

  if (loading) return <Loader />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 font-medium">{error}</p>
      </div>
    )
  }

  const isAdminOrVodic = user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'vodic'

  return (
    <div className="pb-16 md:pb-10">
      <div className="max-w-[1440px] mx-auto">

        {/* ══════════ PAGE HEADER ══════════ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">Akcije</h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 ml-3.5">
              Prijavi se na aktivne akcije ili pogledaj završene.
            </p>
          </div>

          {isAdminOrVodic && (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/dodaj-akciju"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/60 transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nova akcija
              </Link>
              <Link
                to="/profil/dodaj-proslu-akciju"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Prošla akcija
              </Link>
              <button
                type="button"
                onClick={handleOpenAnnualReport}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Godišnji izveštaj
              </button>
            </div>
          )}
        </div>

        {/* ══════════ AKTIVNE AKCIJE ══════════ */}
        <section className="mb-12 sm:mb-16">
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">Aktivne akcije</h2>
            {aktivneAkcije.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                {aktivneAkcije.length}
              </span>
            )}
          </div>

          {aktivneAkcije.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 sm:p-16 text-center max-w-xl mx-auto">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 mb-4">
                <svg className="w-7 h-7 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 font-medium">Trenutno nema aktivnih akcija.</p>
              <p className="text-xs text-gray-400 mt-1">Proverite ponovo uskoro.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
              {aktivneAkcije.map((akcija) => {
                const mmr = computeMMRForAkcija({
                  duzinaStazeKm: akcija.duzinaStazeKm,
                  kumulativniUsponM: akcija.kumulativniUsponM,
                  visinaVrhM: akcija.visinaVrhM,
                  zimskiUspon: akcija.zimskiUspon,
                  tezina: akcija.tezina,
                  datum: akcija.datum,
                })
                const t = tezinaStyle(akcija.tezina)

                return (
                  <Link
                    key={akcija.id}
                    to={`/akcije/${akcija.id}`}
                    className="group bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 hover:no-underline flex flex-col"
                  >
                    {/* Image */}
                    <div className="relative w-full aspect-[3/2] overflow-hidden bg-gray-100">
                      <img
                        src={akcija.slikaUrl || 'https://via.placeholder.com/600x400?text=Bez+slike'}
                        alt={akcija.naziv}
                        className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                        onError={e => { e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Slika+nije+dostupna'; e.currentTarget.onerror = null }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-end justify-between">
                        <span className="text-white/90 text-[10px] font-semibold bg-black/25 backdrop-blur-md px-2 py-0.5 rounded-md">
                          {formatDateShort(akcija.datum)}
                        </span>
                        <span className="text-white text-[10px] font-bold bg-emerald-500/90 px-2 py-0.5 rounded-md shadow-sm">
                          +{mmr} MMR
                        </span>
                      </div>
                      {akcija.zimskiUspon && (
                        <span className="absolute top-2 right-2.5 text-[10px] font-bold text-white bg-sky-500/80 backdrop-blur-sm px-2 py-0.5 rounded-md">
                          Zimski uspon
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-3.5 flex flex-col grow">
                      <h3 className="text-sm font-bold text-gray-900 mb-1.5 line-clamp-2 group-hover:text-emerald-600 transition-colors leading-snug">
                        {akcija.naziv}
                      </h3>

                      <p className="text-[11px] text-gray-400 font-medium truncate mb-2">
                        {akcija.planina ? `${akcija.planina} — ${akcija.vrh}` : akcija.vrh}
                        {akcija.visinaVrhM != null && ` • ${akcija.visinaVrhM} m`}
                      </p>

                      <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium mb-3">
                        {akcija.duzinaStazeKm != null && (
                          <>
                            <span className="flex items-center gap-0.5">
                              <svg className="w-3 h-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                              {akcija.duzinaStazeKm.toFixed(1)} km
                            </span>
                            <span className="w-px h-3 bg-gray-200" />
                          </>
                        )}
                        {akcija.kumulativniUsponM != null && (
                          <span className="flex items-center gap-0.5">
                            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>
                            {akcija.kumulativniUsponM.toLocaleString('sr-RS')} m
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-gray-50">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${t.bg} ${t.text}`}>
                          {t.label}
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600">
                          Aktivna
                        </span>
                      </div>
                    </div>

                    {/* Action button at bottom */}
                    <div className="border-t border-gray-100">
                      {akcija.isCompleted ? (
                        <div className="w-full py-2.5 text-center text-xs font-semibold text-gray-400 bg-gray-50">
                          Akcija završena
                        </div>
                      ) : otkaziveAkcije.has(akcija.id) ? (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOtkaziPrijavu(akcija.id, akcija.naziv) }}
                          className="w-full py-2.5 text-center text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 transition-colors"
                        >
                          Otkaži prijavu
                        </button>
                      ) : prijavljeneAkcije.has(akcija.id) ? (
                        <div className="w-full py-2.5 text-center text-xs font-semibold text-emerald-600 bg-emerald-50 flex items-center justify-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          Popeo se
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePrijavi(akcija.id, akcija.naziv) }}
                          className="w-full py-2.5 text-center text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 transition-all"
                        >
                          Pridruži se
                        </button>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* ══════════ ZAVRŠENE AKCIJE ══════════ */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">Završene akcije</h2>
            {zavrseneAkcije.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-600">
                {zavrseneAkcije.length}
              </span>
            )}
          </div>

          {zavrseneAkcije.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 sm:p-16 text-center max-w-xl mx-auto">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-50 mb-4">
                <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">Još nema završenih akcija.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
              {zavrseneAkcije.map((akcija) => {
                const mmr = computeMMRForAkcija({
                  duzinaStazeKm: akcija.duzinaStazeKm,
                  kumulativniUsponM: akcija.kumulativniUsponM,
                  visinaVrhM: akcija.visinaVrhM,
                  zimskiUspon: akcija.zimskiUspon,
                  tezina: akcija.tezina,
                  datum: akcija.datum,
                })
                const t = tezinaStyle(akcija.tezina)

                return (
                  <Link
                    key={akcija.id}
                    to={`/akcije/${akcija.id}`}
                    className="group bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 hover:no-underline flex flex-col"
                  >
                    {/* Image */}
                    <div className="relative w-full aspect-[3/2] overflow-hidden bg-gray-100">
                      <img
                        src={akcija.slikaUrl || 'https://via.placeholder.com/600x400?text=Bez+slike'}
                        alt={akcija.naziv}
                        className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                        onError={e => { e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Slika+nije+dostupna'; e.currentTarget.onerror = null }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-end justify-between">
                        <span className="text-white/90 text-[10px] font-semibold bg-black/25 backdrop-blur-md px-2 py-0.5 rounded-md">
                          {formatDateShort(akcija.datum)}
                        </span>
                        <span className="text-white text-[10px] font-bold bg-emerald-500/90 px-2 py-0.5 rounded-md shadow-sm">
                          +{mmr} MMR
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-3.5 flex flex-col grow">
                      <h3 className="text-sm font-bold text-gray-900 mb-1.5 line-clamp-2 group-hover:text-emerald-600 transition-colors leading-snug">
                        {akcija.naziv}
                      </h3>

                      <p className="text-[11px] text-gray-400 font-medium truncate mb-2">
                        {akcija.planina ? `${akcija.planina} — ${akcija.vrh}` : akcija.vrh}
                      </p>

                      <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-gray-50">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${t.bg} ${t.text}`}>
                          {t.label}
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500">
                          Završena
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-gray-100">
                      <div className="w-full py-2.5 text-center text-xs font-semibold text-gray-400 bg-gray-50/80">
                        Akcija završena
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* ══════════ MODAL: Godišnji izveštaj ══════════ */}
        {showAnnualReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !loadingReport && setShowAnnualReportModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-50">
                  <svg className="w-4.5 h-4.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Godišnji izveštaj (PDF)</h3>
                  <p className="text-[11px] text-gray-500">Izaberite godinu sa završenim akcijama.</p>
                </div>
              </div>

              <Dropdown
                aria-label="Izaberi godinu"
                options={[
                  { value: '', label: '— Izaberite godinu —' },
                  ...yearsWithCompleted.map((y) => ({ value: String(y), label: String(y) })),
                ]}
                value={selectedYear === '' ? '' : String(selectedYear)}
                onChange={(v) => setSelectedYear(v === '' ? '' : Number(v))}
                fullWidth
              />

              <div className="mt-5 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => !loadingReport && setShowAnnualReportModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Otkaži
                </button>
                <button
                  type="button"
                  onClick={handleGenerateAnnualReportPdf}
                  disabled={loadingReport || selectedYear === ''}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loadingReport ? 'Priprema…' : 'Štampaj'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
