import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { AkcijaImageOrFallback } from '../../../components/AkcijaImageFallback'
import Dropdown from '../../../components/Dropdown'
import { computeMMRForAkcija } from '../../../utils/rankingUtils'
import { tezinaLabel } from '../../../utils/difficultyI18n'
import type { TFunction } from 'i18next'
import ActionsFilterBar, {
  type ActionsFilters,
  type VisibilityFilter,
  type MonthFilter,
  type DurationFilter,
  type DifficultyFilter,
  EMPTY_ACTIONS_FILTERS,
  countActiveFilters,
} from './ActionsFilterBar'

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
  javna?: boolean
  klubNaziv?: string
  duzinaStazeKm?: number
  kumulativniUsponM?: number
  brojDana?: number
}

const TEZINA_STYLE: Record<string, { bg: string; text: string }> = {
  lako: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  srednje: { bg: 'bg-amber-50', text: 'text-amber-700' },
  tesko: { bg: 'bg-rose-50', text: 'text-rose-700' },
  teško: { bg: 'bg-rose-50', text: 'text-rose-700' },
  alpinizam: { bg: 'bg-violet-50', text: 'text-violet-700' },
}

function tezinaStyle(raw: string | undefined, t: TFunction) {
  if (!raw) return { bg: 'bg-gray-50', text: 'text-gray-500', label: tezinaLabel(undefined, t) }
  const k = raw.toLowerCase()
  const style = TEZINA_STYLE[k]
  if (style) return { ...style, label: tezinaLabel(raw, t) }
  return { bg: 'bg-gray-50', text: 'text-gray-500', label: tezinaLabel(raw, t) }
}

export default function Actions() {
  const { t, i18n } = useTranslation('actions')
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
  const [showAddActionModal, setShowAddActionModal] = useState(false)
  const [addActionModalStep, setAddActionModalStep] = useState<'type' | 'kind'>('type')
  const [addActionTip, setAddActionTip] = useState<'planina' | 'via_ferrata' | null>(null)
  const isViaFerrataComingSoon = true
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const filters: ActionsFilters = useMemo(() => {
    const v = searchParams.get('tip')
    const m = searchParams.get('mesec')
    const d = searchParams.get('trajanje')
    const tez = searchParams.get('tezina')
    const validVisibility: VisibilityFilter[] = ['all', 'klubske', 'javne']
    const validDuration: DurationFilter[] = ['all', 'oneDay', 'multiDay']
    const validDifficulty: DifficultyFilter[] = ['all', 'lako', 'srednje', 'tesko', 'alpinizam']
    const monthNum = m ? Number(m) : NaN
    const monthValid = Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12
    return {
      visibility: (v && (validVisibility as string[]).includes(v) ? v : 'all') as VisibilityFilter,
      month: (monthValid ? (monthNum as MonthFilter) : 'all') as MonthFilter,
      duration: (d && (validDuration as string[]).includes(d) ? d : 'all') as DurationFilter,
      difficulty: (tez && (validDifficulty as string[]).includes(tez) ? tez : 'all') as DifficultyFilter,
    }
  }, [searchParams])

  const setFilters = (next: ActionsFilters) => {
    const params = new URLSearchParams(searchParams)
    const writeOrDelete = (key: string, val: string) => {
      if (val === 'all') params.delete(key)
      else params.set(key, val)
    }
    writeOrDelete('tip', next.visibility)
    writeOrDelete('mesec', next.month === 'all' ? 'all' : String(next.month))
    writeOrDelete('trajanje', next.duration)
    writeOrDelete('tezina', next.difficulty)
    setSearchParams(params, { replace: true })
  }

  const matchesFilters = (a: Akcija): boolean => {
    if (filters.visibility === 'klubske' && a.javna) return false
    if (filters.visibility === 'javne' && !a.javna) return false

    if (filters.month !== 'all') {
      if (!a.datum) return false
      const d = new Date(a.datum)
      if (isNaN(d.getTime())) return false
      if (d.getMonth() + 1 !== filters.month) return false
    }

    if (filters.duration !== 'all') {
      const days = a.brojDana ?? 1
      if (filters.duration === 'oneDay' && days > 1) return false
      if (filters.duration === 'multiDay' && days <= 1) return false
    }

    if (filters.difficulty !== 'all') {
      const raw = (a.tezina ?? '').toLowerCase()
      const norm = raw === 'teško' ? 'tesko' : raw
      if (norm !== filters.difficulty) return false
    }
    return true
  }

  const filteredAktivne = useMemo(
    () => aktivneAkcije.filter(matchesFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aktivneAkcije, filters],
  )
  const filteredZavrsene = useMemo(
    () => zavrseneAkcije.filter(matchesFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zavrseneAkcije, filters],
  )

  const availableMonths = useMemo(() => {
    const months = new Set<number>()
    const all = [...aktivneAkcije, ...zavrseneAkcije]
    all.forEach((a) => {
      if (!a.datum) return
      const d = new Date(a.datum)
      if (!isNaN(d.getTime())) months.add(d.getMonth() + 1)
    })
    return Array.from(months).sort((a, b) => a - b)
  }, [aktivneAkcije, zavrseneAkcije])

  const totalCount = aktivneAkcije.length + zavrseneAkcije.length
  const visibleCount = filteredAktivne.length + filteredZavrsene.length
  const activeFilterCount = countActiveFilters(filters)

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
        setError(err.response?.data?.error || t('loadError'))
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
      showAlert(t('noCompletedForAnnual'))
      return
    }
    setSelectedYear(yearsWithCompleted[0] ?? '')
    setShowAnnualReportModal(true)
  }

  const handleOpenAddAction = () => {
    setAddActionModalStep('type')
    setAddActionTip(null)
    setShowAddActionModal(true)
  }

  const handleCloseAddActionModal = () => {
    setShowAddActionModal(false)
    setAddActionModalStep('type')
    setAddActionTip(null)
  }

  const handlePickActionType = (tip: 'planina' | 'via_ferrata') => {
    setAddActionTip(tip)
    setAddActionModalStep('kind')
  }

  const handlePickNovaAkcija = () => {
    if (!addActionTip) return
    handleCloseAddActionModal()
    navigate(`/dodaj-akciju?tip=${addActionTip}`)
  }

  const handlePickProslaAkcija = () => {
    if (!addActionTip) return
    handleCloseAddActionModal()
    navigate(`/profil/dodaj-proslu-akciju?tip=${addActionTip}`)
  }

  const handleGenerateAnnualReportPdf = async () => {
    if (selectedYear === '') {
      await showAlert(t('pickYear'))
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
        await showAlert(t('noCompletedForYear', { year: selectedYear }))
        setLoadingReport(false)
        return
      }
      const sorted = [...actionsInYear].sort(
        (a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime()
      )

      const korisniciRes = await api.get('/api/korisnici')
      const korisniciList = (korisniciRes.data.korisnici || []) as Array<{
        id: number
        username?: string
        datum_rodjenja?: string | null
        pol?: string
      }>
      const userDataById: Record<number, { datum_rodjenja?: string | null; pol?: string }> = {}
      const userDataByUsername: Record<string, { datum_rodjenja?: string | null; pol?: string }> = {}
      korisniciList.forEach((k) => {
        userDataById[k.id] = {
          datum_rodjenja: k.datum_rodjenja ?? null,
          pol: k.pol,
        }
        if (k.username) {
          userDataByUsername[k.username] = {
            datum_rodjenja: k.datum_rodjenja ?? null,
            pol: k.pol,
          }
        }
      })

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
          const userMeta =
            (p.userId != null ? userDataById[p.userId] : undefined) ??
            (p.korisnik ? userDataByUsername[p.korisnik] : undefined)
          participants.push({
            datum_rodjenja: p.datum_rodjenja ?? userMeta?.datum_rodjenja ?? null,
            pol: p.pol ?? userMeta?.pol,
          })
        }
        const counts = computeCountsForParticipants(participants, akcija.datum)
        rows.push({
          rb: i + 1,
          nazivIMesto,
          datum: akcija.datum,
          counts,
        })
      }
      let clubName = sorted.find((a) => a.klubNaziv)?.klubNaziv || ''
      try {
        const klubRes = await api.get('/api/klub')
        const naziv = (klubRes.data?.klub?.naziv as string | undefined) || (klubRes.data?.naziv as string | undefined)
        if (naziv?.trim()) clubName = naziv.trim()
      } catch {
        // fallback ostaje iz akcije ako postoji
      }
      generateAnnualReportPdf(rows, { clubName })
      setShowAnnualReportModal(false)
    } catch (err: unknown) {
      console.error(err)
      await showAlert(t('annualPrepareError'))
    } finally {
      setLoadingReport(false)
    }
  }

  const handlePrijavi = async (akcijaId: number, naziv: string) => {
    const confirmed = await showConfirm(t('confirmJoin', { name: naziv }))
    if (!confirmed) return

    try {
      const response = await api.post(`/api/akcije/${akcijaId}/prijavi`)
      await showAlert(response.data.message)

      setPrijavljeneAkcije(prev => new Set([...prev, akcijaId]))
      setOtkaziveAkcije(prev => new Set([...prev, akcijaId]))
    } catch (err: any) {
      const errMsg = err.response?.data?.error
      const status = err?.response?.status
      if (status === 409) {
        await showAlert(t('alreadyJoined'))
        setPrijavljeneAkcije(prev => new Set([...prev, akcijaId]))
        setOtkaziveAkcije(prev => new Set([...prev, akcijaId]))
        return
      }
      await showAlert(typeof errMsg === 'string' ? errMsg : t('joinError'))
    }
  }

  const handleOtkaziPrijavu = async (akcijaId: number, naziv: string) => {
    const confirmed = await showConfirm(t('confirmCancelJoin', { name: naziv }))
    if (!confirmed) return

    try {
      await api.delete(`/api/akcije/${akcijaId}/prijavi`)
      await showAlert(t('cancelJoinSuccess'))

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
      await showAlert(err.response?.data?.error || t('cancelJoinError'))
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
        <p className="text-sm text-gray-500 font-medium">{t('loginRequired')}</p>
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
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">{t('title')}</h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 ml-3.5">
              {t('subtitle')}
            </p>
          </div>

          {isAdminOrVodic && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddAction}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/60 transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t('addAction')}
              </button>
              <button
                type="button"
                onClick={handleOpenAnnualReport}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t('annualReport')}
              </button>
            </div>
          )}
        </div>

        {/* ══════════ FILTER BAR ══════════ */}
        {totalCount > 0 && (
          <ActionsFilterBar
            filters={filters}
            onChange={setFilters}
            availableMonths={availableMonths}
            totalCount={totalCount}
            visibleCount={visibleCount}
          />
        )}

        {/* ══════════ AKTIVNE AKCIJE ══════════ */}
        <section className="mb-12 sm:mb-16">
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">{t('activeActions')}</h2>
            {aktivneAkcije.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                {activeFilterCount > 0 ? `${filteredAktivne.length}/${aktivneAkcije.length}` : aktivneAkcije.length}
              </span>
            )}
          </div>

          {filteredAktivne.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 sm:p-16 text-center max-w-xl mx-auto">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 mb-4">
                <svg className="w-7 h-7 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              {activeFilterCount > 0 && aktivneAkcije.length > 0 ? (
                <>
                  <p className="text-sm text-gray-500 font-medium">{t('filters.noResultsActive')}</p>
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_ACTIONS_FILTERS)}
                    className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                  >
                    {t('filters.reset')}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 font-medium">{t('emptyActive')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('checkSoon')}</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
              {filteredAktivne.map((akcija) => {
                const mmr = computeMMRForAkcija({
                  duzinaStazeKm: akcija.duzinaStazeKm,
                  kumulativniUsponM: akcija.kumulativniUsponM,
                  visinaVrhM: akcija.visinaVrhM,
                  zimskiUspon: akcija.zimskiUspon,
                  tezina: akcija.tezina,
                  datum: akcija.datum,
                })
                const difficultyBadge = tezinaStyle(akcija.tezina, t)

                return (
                  <Link
                    key={akcija.id}
                    to={`/akcije/${akcija.id}`}
                    className={`group bg-white rounded-xl border border-gray-100 overflow-hidden hover:-translate-y-0.5 transition-all duration-300 hover:no-underline flex flex-col ${
                      akcija.javna
                        ? 'shadow-[0_2px_20px_-2px_rgba(180,83,9,0.28),0_10px_40px_-4px_rgba(245,158,11,0.24),0_0_52px_-8px_rgba(253,224,71,0.38)] hover:shadow-[0_4px_28px_-2px_rgba(180,83,9,0.34),0_14px_48px_-4px_rgba(245,158,11,0.3),0_0_64px_-6px_rgba(253,224,71,0.48)]'
                        : 'shadow-sm hover:shadow-md'
                    }`}
                  >
                    {/* Image */}
                    <div className="relative w-full aspect-[3/2] overflow-hidden bg-gray-100">
                      <AkcijaImageOrFallback
                        src={akcija.slikaUrl}
                        alt={akcija.naziv}
                        imgClassName="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-end justify-between">
                        <span className="text-white/90 text-[10px] font-semibold bg-black/25 backdrop-blur-md px-2 py-0.5 rounded-md">
                          {formatDateShort(akcija.datum)}
                        </span>
                        <span className="text-white text-[10px] font-bold bg-emerald-500/90 px-2 py-0.5 rounded-md shadow-sm">
                          +{mmr} MMR
                        </span>
                      </div>
                      {akcija.javna && (
                        <span className="absolute top-2 left-2.5 text-[10px] font-bold text-amber-950 bg-gradient-to-r from-amber-400 to-yellow-500 backdrop-blur-sm px-2 py-0.5 rounded-md shadow-sm ring-1 ring-amber-200/60">
                          {t('public')}
                        </span>
                      )}
                      {akcija.zimskiUspon && (
                        <span className="absolute top-2 right-2.5 text-[10px] font-bold text-white bg-sky-500/80 backdrop-blur-sm px-2 py-0.5 rounded-md">
                          {t('winterAscent')}
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

                      {akcija.javna && akcija.klubNaziv && (
                        <p className="text-[10px] text-amber-800/90 font-semibold truncate mb-2 flex items-center gap-1">
                          <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                          </svg>
                          {akcija.klubNaziv}
                        </p>
                      )}

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
                            {akcija.kumulativniUsponM.toLocaleString(i18n.language)} m
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-gray-50">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${difficultyBadge.bg} ${difficultyBadge.text}`}>
                          {difficultyBadge.label}
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600">
                          {t('active')}
                        </span>
                      </div>
                    </div>

                    {/* Action button at bottom */}
                    <div className="border-t border-gray-100">
                      {akcija.isCompleted ? (
                        <div className="w-full py-2.5 text-center text-xs font-semibold text-gray-400 bg-gray-50">
                          {t('actionCompleted')}
                        </div>
                      ) : otkaziveAkcije.has(akcija.id) ? (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOtkaziPrijavu(akcija.id, akcija.naziv) }}
                          className="w-full py-2.5 text-center text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 transition-colors"
                        >
                          {t('cancelJoin')}
                        </button>
                      ) : prijavljeneAkcije.has(akcija.id) ? (
                        <div className="w-full py-2.5 text-center text-xs font-semibold text-emerald-600 bg-emerald-50 flex items-center justify-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          {t('climbed')}
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePrijavi(akcija.id, akcija.naziv) }}
                          className="w-full py-2.5 text-center text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 transition-all"
                        >
                          {t('join')}
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
            <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">{t('completedActions')}</h2>
            {zavrseneAkcije.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-600">
                {activeFilterCount > 0 ? `${filteredZavrsene.length}/${zavrseneAkcije.length}` : zavrseneAkcije.length}
              </span>
            )}
          </div>

          {filteredZavrsene.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 sm:p-16 text-center max-w-xl mx-auto">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-50 mb-4">
                <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              {activeFilterCount > 0 && zavrseneAkcije.length > 0 ? (
                <>
                  <p className="text-sm text-gray-500 font-medium">{t('filters.noResultsCompleted')}</p>
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_ACTIONS_FILTERS)}
                    className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                  >
                    {t('filters.reset')}
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-400">{t('emptyCompleted')}</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
              {filteredZavrsene.map((akcija) => {
                const mmr = computeMMRForAkcija({
                  duzinaStazeKm: akcija.duzinaStazeKm,
                  kumulativniUsponM: akcija.kumulativniUsponM,
                  visinaVrhM: akcija.visinaVrhM,
                  zimskiUspon: akcija.zimskiUspon,
                  tezina: akcija.tezina,
                  datum: akcija.datum,
                })
                const difficultyBadge = tezinaStyle(akcija.tezina, t)

                return (
                  <Link
                    key={akcija.id}
                    to={`/akcije/${akcija.id}`}
                    className={`group bg-white rounded-xl border border-gray-100 overflow-hidden hover:-translate-y-0.5 transition-all duration-300 hover:no-underline flex flex-col ${
                      akcija.javna
                        ? 'shadow-[0_2px_18px_-2px_rgba(180,83,9,0.24),0_8px_36px_-4px_rgba(245,158,11,0.2),0_0_48px_-8px_rgba(253,224,71,0.32)] hover:shadow-[0_4px_24px_-2px_rgba(180,83,9,0.3),0_12px_44px_-4px_rgba(245,158,11,0.26),0_0_58px_-6px_rgba(253,224,71,0.42)]'
                        : 'shadow-sm hover:shadow-md'
                    }`}
                  >
                    {/* Image */}
                    <div className="relative w-full aspect-[3/2] overflow-hidden bg-gray-100">
                      <AkcijaImageOrFallback
                        src={akcija.slikaUrl}
                        alt={akcija.naziv}
                        imgClassName="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-end justify-between">
                        <span className="text-white/90 text-[10px] font-semibold bg-black/25 backdrop-blur-md px-2 py-0.5 rounded-md">
                          {formatDateShort(akcija.datum)}
                        </span>
                        <span className="text-white text-[10px] font-bold bg-emerald-500/90 px-2 py-0.5 rounded-md shadow-sm">
                          +{mmr} MMR
                        </span>
                      </div>
                      {akcija.javna && (
                        <span className="absolute top-2 left-2.5 text-[10px] font-bold text-amber-950 bg-gradient-to-r from-amber-400 to-yellow-500 backdrop-blur-sm px-2 py-0.5 rounded-md shadow-sm ring-1 ring-amber-200/60">
                          {t('public')}
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
                      </p>

                      {akcija.javna && akcija.klubNaziv && (
                        <p className="text-[10px] text-amber-800/90 font-semibold truncate mb-2 flex items-center gap-1">
                          <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                          </svg>
                          {akcija.klubNaziv}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-gray-50">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${difficultyBadge.bg} ${difficultyBadge.text}`}>
                          {difficultyBadge.label}
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500">
                          {t('completed')}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-gray-100">
                      <div className="w-full py-2.5 text-center text-xs font-semibold text-gray-400 bg-gray-50/80">
                        {t('actionCompleted')}
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
                  <h3 className="text-sm font-bold text-gray-900">{t('annualReportPdf')}</h3>
                  <p className="text-[11px] text-gray-500">{t('annualReportPickYear')}</p>
                </div>
              </div>

              <Dropdown
                aria-label={t('chooseYear')}
                options={[
                  { value: '', label: t('chooseYearPlaceholder') },
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
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleGenerateAnnualReportPdf}
                  disabled={loadingReport || selectedYear === ''}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loadingReport ? t('preparing') : t('print')}
                </button>
              </div>
            </div>
          </div>
        )}
        {showAddActionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={handleCloseAddActionModal}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100" onClick={(e) => e.stopPropagation()}>
              {addActionModalStep === 'type' && (
                <>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">{t('addActionModalTypeTitle')}</h3>
                  <p className="text-xs text-gray-500 mb-4">{t('addActionModalTypeHint')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handlePickActionType('planina')}
                      className="px-3 py-2.5 rounded-xl text-xs font-semibold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:scale-[0.98] transition-all"
                    >
                      {t('addActionModalMountain')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePickActionType('via_ferrata')}
                      disabled={isViaFerrataComingSoon}
                      title={isViaFerrataComingSoon ? t('checkSoon') : undefined}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        isViaFerrataComingSoon
                          ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                          : 'border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100 active:scale-[0.98]'
                      }`}
                    >
                      <span>{t('addActionModalViaFerrata')}</span>
                      {isViaFerrataComingSoon && (
                        <span className="ml-1.5 inline-flex rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 border border-gray-200">
                          {t('checkSoon')}
                        </span>
                      )}
                    </button>
                  </div>
                </>
              )}
              {addActionModalStep === 'kind' && addActionTip && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAddActionModalStep('type')
                      setAddActionTip(null)
                    }}
                    className="mb-3 text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('addActionModalBack')}
                  </button>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">{t('addActionModalKindTitle')}</h3>
                  <p className="text-xs text-gray-500 mb-4">{t('addActionModalKindHint')}</p>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={handlePickNovaAkcija}
                      className="px-3 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm active:scale-[0.98] transition-all"
                    >
                      {t('newAction')}
                    </button>
                    <button
                      type="button"
                      onClick={handlePickProslaAkcija}
                      className="px-3 py-2.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 bg-white hover:border-amber-300 hover:bg-amber-50/80 hover:text-amber-900 active:scale-[0.98] transition-all"
                    >
                      {t('pastAction')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
