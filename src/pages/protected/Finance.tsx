import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import Dropdown from '../../components/Dropdown'
import CalendarDropdown from '../../components/CalendarDropdown'
import Loader from '../../components/Loader'
import { formatDateShort, dateToYMD } from '../../utils/dateUtils'
import { generateFinanceReportPdf } from '../../utils/generateFinanceReportPdf'
import { PrinterIcon } from '@heroicons/react/24/outline'

type Tab = 'dashboard' | 'clanarine' | 'transakcije'
type TransakcijaFilter = 'sve' | 'uplata' | 'isplata'

interface Transakcija {
  id: number
  tip: string
  iznos: number
  opis?: string
  datum: string
  korisnikId: number
  clanarinaKorisnikId?: number
  createdAt: string
  korisnik?: { fullName?: string; username?: string }
  clanarinaKorisnik?: { fullName?: string; username?: string }
}

interface DashboardData {
  saldo: number
  uplate: number
  isplate: number
  transakcije: Transakcija[]
  from: string
  to: string
}

interface ClanarinaRow {
  id: number
  fullName: string
  username: string
  platio: boolean
}

export default function Finance() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('dashboard')

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const todayYmd = dateToYMD(new Date())
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 5
  const currentYear = new Date().getFullYear()
  const firstDayOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
  const lastDayOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const prevYear = currentYear - 1
  const [fromDate, setFromDate] = useState(() => dateToYMD(new Date(prevYear, 0, 1)))
  const [toDate, setToDate] = useState(() => dateToYMD(new Date(currentYear, 11, 31)))
  const [periodPreset, setPeriodPreset] = useState<'danas' | 'mesec' | 'godina' | 'dveGodine'>('dveGodine')
  const [transakcijaFilter, setTransakcijaFilter] = useState<TransakcijaFilter>('sve')

  const [clanarine, setClanarine] = useState<ClanarinaRow[]>([])
  const [clanarineLoading, setClanarineLoading] = useState(false)
  const [clanarineGodina, setClanarineGodina] = useState(Math.max(2026, new Date().getFullYear()))
  const [platiLoading, setPlatiLoading] = useState<number | null>(null)
  const [clanarinaIznos, setClanarinaIznos] = useState(2320)
  const [error, setError] = useState('')

  const [transakcijaTip, setTransakcijaTip] = useState<'uplata' | 'isplata'>('uplata')
  const [transakcijaIznos, setTransakcijaIznos] = useState('')
  const [transakcijaDatum, setTransakcijaDatum] = useState(() => dateToYMD(new Date()))
  const [transakcijaUplatilac, setTransakcijaUplatilac] = useState('')
  const [transakcijaOpis, setTransakcijaOpis] = useState('')
  const [transakcijaSubmitting, setTransakcijaSubmitting] = useState(false)

  const fetchDashboard = async () => {
    if (!user) return
    setDashboardLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate })
      const res = await api.get(`/api/finansije/dashboard?${params}`)
      const data = res.data as DashboardData
      setDashboardData({
        ...data,
        transakcije: Array.isArray(data?.transakcije) ? data.transakcije : [],
      })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Greška pri učitavanju'
      setError(msg)
    } finally {
      setDashboardLoading(false)
    }
  }

  const fetchClanarine = async () => {
    if (!user) return
    setClanarineLoading(true)
    setError('')
    try {
      const res = await api.get(`/api/finansije/clanarine?godina=${clanarineGodina}`)
      setClanarine(res.data.clanarine || [])
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Greška pri učitavanju'
      setError(msg)
    } finally {
      setClanarineLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'dashboard') fetchDashboard()
    else if (tab === 'clanarine') fetchClanarine()
  }, [tab, fromDate, toDate, clanarineGodina])

  const handleNovaTransakcija = async (e: React.FormEvent) => {
    e.preventDefault()
    const iznos = Number(transakcijaIznos?.replace(/,/g, '.'))
    if (!iznos || iznos <= 0) {
      setError('Unesite validan iznos.')
      return
    }
    if (transakcijaDatum > todayYmd) {
      setError('Datum ne može biti u budućnosti.')
      return
    }
    const opis = [transakcijaUplatilac.trim(), transakcijaOpis.trim()].filter(Boolean).join(' – ') || undefined
    setTransakcijaSubmitting(true)
    setError('')
    try {
      await api.post('/api/finansije', {
        tip: transakcijaTip,
        iznos,
        datum: transakcijaDatum,
        opis: opis || '',
      })
      setTransakcijaIznos('')
      setTransakcijaOpis('')
      setTransakcijaUplatilac('')
      setTransakcijaDatum(dateToYMD(new Date()))
      await fetchDashboard()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Greška pri čuvanju'
      setError(msg)
    } finally {
      setTransakcijaSubmitting(false)
    }
  }

  const handlePlati = async (korisnikId: number) => {
    setPlatiLoading(korisnikId)
    setError('')
    try {
      const today = dateToYMD(new Date())
      await api.post('/api/finansije/clanarina', {
        korisnikId,
        iznos: clanarinaIznos,
        datum: today,
      })
      await fetchClanarine()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Greška'
      setError(msg)
    } finally {
      setPlatiLoading(null)
    }
  }

  if (!user) return null

  const filteredTransakcije = dashboardData?.transakcije.filter((t) => {
    if (transakcijaFilter === 'sve') return true
    return t.tip === transakcijaFilter
  }) ?? []

  const totalPages = Math.max(1, Math.ceil(filteredTransakcije.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedTransakcije = filteredTransakcije.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  )

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
    {
      key: 'clanarine',
      label: 'Članarine',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      key: 'transakcije',
      label: 'Uplate / Isplate',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      ),
    },
  ]

  return (
    <div className="pb-16 md:pb-10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8 space-y-6 sm:space-y-8">

        {/* ══════════ PAGE HEADER ══════════ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">Finansije</h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 ml-3.5 max-w-xl">
              Prati stanje blagajne, članarine i sve transakcije kluba.
            </p>
          </div>
          {dashboardData && tab === 'dashboard' && (
            <button
              type="button"
              onClick={() =>
                generateFinanceReportPdf({
                  from: fromDate,
                  to: toDate,
                  transakcije: dashboardData.transakcije,
                  uplate: dashboardData.uplate,
                  isplate: dashboardData.isplate,
                  saldo: dashboardData.saldo,
                })
              }
              title="Štampa PDF izveštaj za period"
              aria-label="Štampa PDF izveštaj"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
            >
              <PrinterIcon className="w-4 h-4" />
              PDF izveštaj
            </button>
          )}
        </div>

        {/* ══════════ TABS ══════════ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex divide-x divide-gray-100">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => { setTab(t.key); setCurrentPage(1) }}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 sm:py-4 text-xs sm:text-sm font-semibold transition-all ${
                  tab === t.key
                    ? 'text-emerald-600 bg-emerald-50/60'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/60'
                }`}
              >
                <span className={`${tab === t.key ? 'text-emerald-500' : 'text-gray-400'}`}>{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white flex-shrink-0">!</span>
            <span>{error}</span>
          </div>
        )}

        {/* ══════════ DASHBOARD TAB ══════════ */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {/* Period controls */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Podešavanje perioda</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Izaberi vremenski opseg za prikaz finansija.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Dropdown
                    aria-label="Filter transakcija"
                    options={[
                      { value: 'sve', label: 'Sve transakcije' },
                      { value: 'uplata', label: 'Samo uplate' },
                      { value: 'isplata', label: 'Samo isplate' },
                    ]}
                    value={transakcijaFilter}
                    onChange={(v) => setTransakcijaFilter(v as TransakcijaFilter)}
                    minTriggerWidth="170px"
                    className="[&_button]:min-h-[38px] [&_button]:rounded-xl [&_button]:border-gray-200 [&_button]:shadow-sm [&_button]:hover:bg-gray-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <span className="block text-gray-500 font-semibold text-[11px] uppercase tracking-wider">Period</span>
                  <Dropdown
                    aria-label="Period finansijskog izveštaja"
                    options={[
                      { value: 'danas', label: 'Danas' },
                      { value: 'mesec', label: 'Ovaj mesec' },
                      { value: 'godina', label: 'Ova godina' },
                      { value: 'dveGodine', label: 'Prošla + ova godina' },
                    ]}
                    value={periodPreset}
                    onChange={(v) => {
                      const value = v as 'danas' | 'mesec' | 'godina' | 'dveGodine'
                      setPeriodPreset(value)
                      const now = new Date()
                      if (value === 'danas') {
                        const ymd = dateToYMD(now)
                        setFromDate(ymd)
                        setToDate(ymd)
                      } else if (value === 'mesec') {
                        setFromDate(dateToYMD(firstDayOfMonth(now)))
                        setToDate(dateToYMD(lastDayOfMonth(now)))
                      } else if (value === 'godina') {
                        setFromDate(`${currentYear}-01-01`)
                        setToDate(`${currentYear}-12-31`)
                      } else {
                        setFromDate(`${prevYear}-01-01`)
                        setToDate(`${currentYear}-12-31`)
                      }
                    }}
                    minTriggerWidth="180px"
                    className="[&_button]:min-h-[38px] [&_button]:w-full [&_button]:rounded-xl [&_button]:border-gray-200 [&_button]:shadow-sm [&_button]:hover:bg-gray-50"
                  />
                </div>

                <div className="space-y-1.5 lg:col-span-2">
                  <span className="block text-gray-500 font-semibold text-[11px] uppercase tracking-wider">Ručni odabir datuma</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-gray-400 font-medium">Od</span>
                      <CalendarDropdown
                        value={fromDate}
                        onChange={setFromDate}
                        placeholder="Od datuma"
                        maxDate={toDate}
                        aria-label="Period od"
                        minTriggerWidth="160px"
                        className="w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-gray-400 font-medium">Do</span>
                      <CalendarDropdown
                        value={toDate}
                        onChange={setToDate}
                        placeholder="Do datuma"
                        minDate={fromDate}
                        aria-label="Period do"
                        minTriggerWidth="160px"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {dashboardLoading ? (
              <Loader />
            ) : dashboardData ? (
              <>
                {/* ── Summary cards ── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-3 divide-y divide-gray-100 sm:divide-y-0 sm:divide-x">
                    <SummaryCell
                      icon={
                        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                        </svg>
                      }
                      iconBg="bg-emerald-50"
                      value={`${dashboardData.saldo.toLocaleString('sr-RS')} RSD`}
                      label="Stanje"
                      accent={dashboardData.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}
                    />
                    <SummaryCell
                      icon={
                        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      }
                      iconBg="bg-green-50"
                      value={`${dashboardData.uplate.toLocaleString('sr-RS')} RSD`}
                      label="Uplate"
                      accent="text-green-600"
                    />
                    <SummaryCell
                      icon={
                        <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                        </svg>
                      }
                      iconBg="bg-rose-50"
                      value={`${dashboardData.isplate.toLocaleString('sr-RS')} RSD`}
                      label="Isplate"
                      accent="text-rose-600"
                    />
                  </div>
                </div>

                {/* ── Transaction list ── */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100">
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">Transakcije u periodu</h2>
                    {filteredTransakcije.length > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                        {filteredTransakcije.length}
                      </span>
                    )}
                  </div>

                  {filteredTransakcije.length === 0 ? (
                    <EmptyState
                      icon={
                        <svg className="w-6 h-6 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                        </svg>
                      }
                      text="Nema transakcija za izabrani period i filter."
                      sub="Pokušaj da promeniš period ili filter."
                    />
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      {/* Desktop table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                          <thead>
                            <tr className="bg-gray-50/80">
                              <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Datum</th>
                              <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tip</th>
                              <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Iznos</th>
                              <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Opis</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {paginatedTransakcije.map((t) => (
                              <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-5 py-3.5 text-sm text-gray-600 font-medium">{formatDateShort(t.datum)}</td>
                                <td className="px-5 py-3.5">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                      t.tip === 'uplata' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                    }`}
                                  >
                                    {t.tip}
                                  </span>
                                  {t.clanarinaKorisnik && (
                                    <span className="ml-2 text-xs text-gray-400">
                                      ({t.clanarinaKorisnik.fullName || t.clanarinaKorisnik.username})
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">
                                  {Math.abs(t.iznos).toLocaleString('sr-RS')} RSD
                                </td>
                                <td className="px-5 py-3.5 text-sm text-gray-500 max-w-[12rem] sm:max-w-[16rem]">
                                  <span className="block truncate" title={t.opis || undefined}>
                                    {t.opis || '—'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile cards */}
                      <div className="sm:hidden divide-y divide-gray-50">
                        {paginatedTransakcije.map((t) => (
                          <div key={t.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                            <div className="flex justify-between items-start gap-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                  t.tip === 'uplata' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {t.tip}
                              </span>
                              <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                                {Math.abs(t.iznos).toLocaleString('sr-RS')} RSD
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 font-medium mt-1.5">{formatDateShort(t.datum)}</p>
                            <p className="text-sm text-gray-600 mt-1 truncate max-w-full" title={t.opis || undefined}>
                              {t.opis || '—'}
                            </p>
                            {t.clanarinaKorisnik && (
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                ({t.clanarinaKorisnik.fullName || t.clanarinaKorisnik.username})
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && <Pagination currentPage={safeCurrentPage} totalPages={totalPages} onPageChange={setCurrentPage} />}
                    </div>
                  )}
                </section>
              </>
            ) : null}
          </div>
        )}

        {/* ══════════ TRANSAKCIJE TAB ══════════ */}
        {tab === 'transakcije' && (
          <div className="flex justify-center">
            <div className="max-w-xl w-full">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible">
                <div className="p-5 sm:p-6">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="flex-shrink-0 h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Nova transakcija</h3>
                      <p className="text-[11px] text-gray-500">Dodaj uplatu ili isplatu u blagajnu kluba.</p>
                    </div>
                  </div>

                  <form onSubmit={handleNovaTransakcija} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tip</label>
                      <Dropdown
                        options={[
                          { value: 'uplata', label: 'Uplata' },
                          { value: 'isplata', label: 'Isplata' },
                        ]}
                        value={transakcijaTip}
                        onChange={(v) => setTransakcijaTip(v as 'uplata' | 'isplata')}
                        fullWidth
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        {transakcijaTip === 'uplata' ? 'Ko je uplatio (opciono)' : 'Kome / za šta (opciono)'}
                      </label>
                      <input
                        type="text"
                        value={transakcijaUplatilac}
                        onChange={(e) => setTransakcijaUplatilac(e.target.value)}
                        placeholder={transakcijaTip === 'uplata' ? 'npr. Ime prezime' : 'npr. Dobavljač, svrha'}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Iznos (RSD) *</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={transakcijaIznos}
                        onChange={(e) => setTransakcijaIznos(e.target.value.replace(/[^0-9,.]/g, ''))}
                        placeholder="npr. 5000"
                        required
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Datum *</label>
                      <CalendarDropdown
                        value={transakcijaDatum}
                        onChange={setTransakcijaDatum}
                        placeholder="Izaberite datum"
                        maxDate={todayYmd}
                        fullWidth
                        aria-label="Datum transakcije"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Opis (opciono)</label>
                      <input
                        type="text"
                        value={transakcijaOpis}
                        onChange={(e) => setTransakcijaOpis(e.target.value)}
                        placeholder="npr. Članarina, kupovina opreme..."
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={transakcijaSubmitting}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {transakcijaSubmitting ? 'Čuvanje...' : 'Sačuvaj transakciju'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ ČLANARINE TAB ══════════ */}
        {tab === 'clanarine' && (
          <div className="space-y-6">
            {/* Info banner */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50 flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
              </span>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                Status članarine računa se posebno za svaku godinu. Kada nastupi nova godina, svi članovi su za narednu godinu početno neplaćeni.
              </p>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
              <div className="flex flex-wrap gap-4 sm:gap-6 items-end">
                <div className="space-y-1.5">
                  <span className="block text-gray-500 font-semibold text-[11px] uppercase tracking-wider">Godina</span>
                  <Dropdown
                    aria-label="Godina članarine"
                    options={Array.from({ length: Math.max(0, currentYear - 2026 + 1) }, (_, i) => 2026 + i)
                      .sort((a, b) => b - a)
                      .map((y) => ({ value: String(y), label: `${y}.` }))}
                    value={String(clanarineGodina)}
                    onChange={(v) => setClanarineGodina(Number(v))}
                    minTriggerWidth="120px"
                    className="[&_button]:min-h-[38px] [&_button]:rounded-xl [&_button]:border-gray-200 [&_button]:shadow-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="block text-gray-500 font-semibold text-[11px] uppercase tracking-wider">Iznos članarine (RSD)</span>
                  <input
                    type="number"
                    min={1}
                    value={clanarinaIznos}
                    onChange={(e) => setClanarinaIznos(Number(e.target.value) || 0)}
                    className="w-24 sm:w-28 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {clanarineLoading ? (
              <Loader />
            ) : clanarine.length === 0 ? (
              <EmptyState
                icon={
                  <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                }
                text="Nema korisnika."
                sub="Dodajte članove u klub da biste videli njihove članarine."
              />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead>
                      <tr className="bg-gray-50/80">
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Korisnik</th>
                        <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {clanarine.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-gray-900">{row.fullName || row.username}</span>
                            {row.fullName && <span className="ml-2 text-xs text-gray-400">@{row.username}</span>}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {row.platio ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold text-sm">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                Platio
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePlati(row.id)}
                                disabled={platiLoading === row.id}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {platiLoading === row.id ? 'Čeka se...' : 'Plati'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-gray-50">
                  {clanarine.map((row) => (
                    <div key={row.id} className="p-4 flex justify-between items-center gap-3">
                      <div className="min-w-0">
                        <span className="font-semibold text-gray-900 block truncate">{row.fullName || row.username}</span>
                        {row.fullName && <span className="text-xs text-gray-400">@{row.username}</span>}
                      </div>
                      <div className="flex-shrink-0">
                        {row.platio ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-sm">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            Platio
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePlati(row.id)}
                            disabled={platiLoading === row.id}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {platiLoading === row.id ? '...' : 'Plati'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════ */

function SummaryCell({ icon, iconBg, value, label, accent }: {
  icon: React.ReactNode
  iconBg: string
  value: string
  label: string
  accent: string
}) {
  return (
    <div className="flex items-center justify-between sm:justify-center gap-3 py-4 px-4 sm:px-3">
      <div className={`flex-shrink-0 h-8 w-8 rounded-xl ${iconBg} flex items-center justify-center`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1 sm:flex-initial">
        <p className={`text-base sm:text-lg font-extrabold leading-none tracking-tight ${accent} break-words`}>
          {value}
        </p>
        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function Pagination({ currentPage, totalPages, onPageChange }: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  const prevDisabled = currentPage === 1
  const nextDisabled = currentPage === totalPages

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | 'ellipsis')[] = [1]
    const left = Math.max(2, currentPage - 1)
    const right = Math.min(totalPages - 1, currentPage + 1)
    if (left > 2) pages.push('ellipsis')
    for (let p = left; p <= right; p++) if (p !== 1 && p !== totalPages) pages.push(p)
    if (right < totalPages - 1) pages.push('ellipsis')
    if (totalPages > 1) pages.push(totalPages)
    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div className="border-t border-gray-100 bg-gray-50/50 px-3 sm:px-4 py-3 sm:py-3.5">
      <div className="flex items-center justify-center gap-1 sm:gap-2 min-w-0 max-w-full">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={prevDisabled}
          aria-label="Prethodna strana"
          className="shrink-0 inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Prethodna</span>
        </button>
        <div className="flex items-center justify-center gap-0.5 sm:gap-1 min-w-0 flex-1 max-w-full overflow-hidden">
          {pageNumbers.map((page, idx) =>
            page === 'ellipsis' ? (
              <span key={`e-${idx}`} className="px-1 sm:px-1.5 text-gray-400 select-none text-sm" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                aria-label={`Strana ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
                className={`shrink-0 min-w-[2rem] w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-sm font-medium transition-all ${
                  page === currentPage
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-500/30'
                    : 'bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100'
                }`}
              >
                {page}
              </button>
            )
          )}
        </div>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={nextDisabled}
          aria-label="Sledeća strana"
          className="shrink-0 inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100"
        >
          <span className="hidden sm:inline">Sledeća</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <p className="text-center text-[11px] text-gray-400 font-medium mt-2 sm:mt-2.5">
        Strana {currentPage} od {totalPages}
      </p>
    </div>
  )
}

function EmptyState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-10 sm:p-14 text-center max-w-xl mx-auto">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 mb-3">
        {icon}
      </div>
      <p className="text-sm text-gray-500 font-medium">{text}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}
