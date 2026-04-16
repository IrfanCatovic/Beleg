import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import Dropdown from '../../components/Dropdown'
import CalendarDropdown from '../../components/CalendarDropdown'
import DatePartsSelect from '../../components/DatePartsSelect'
import Loader from '../../components/Loader'
import { formatDateShort, dateToYMD } from '../../utils/dateUtils'
import { generateFinanceReportPdf } from '../../utils/generateFinanceReportPdf'
import { PrinterIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

type Tab = 'dashboard' | 'clanarine' | 'transakcije'
type TransakcijaFilter = 'sve' | 'uplata' | 'isplata'
type CurrencyCode = 'RSD' | 'BAM' | 'HRK' | 'EUR'
type DatePickType = 'day' | 'month' | 'year' | 'range'

interface KlubCurrencyResponse {
  klub?: {
    valuta?: string
  }
}

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
  const { t } = useTranslation('finance')
  const [tab, setTab] = useState<Tab>('dashboard')
  const [currency, setCurrency] = useState<CurrencyCode>('RSD')
  const [currencySaving, setCurrencySaving] = useState(false)

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const todayYmd = dateToYMD(new Date())
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 5
  const currentYear = new Date().getFullYear()
  const prevYear = currentYear - 1
  const [fromDate, setFromDate] = useState(() => dateToYMD(new Date(prevYear, 0, 1)))
  const [toDate, setToDate] = useState(() => dateToYMD(new Date(currentYear, 11, 31)))
  const [dateModalOpen, setDateModalOpen] = useState(false)
  const [datePickType, setDatePickType] = useState<DatePickType>('range')
  const [dayValue, setDayValue] = useState(todayYmd)
  const [monthYear, setMonthYear] = useState<{ year: number; month: number }>({ year: currentYear, month: new Date().getMonth() + 1 })
  const [yearValue, setYearValue] = useState(currentYear)
  const [rangeStart, setRangeStart] = useState(fromDate)
  const [rangeEnd, setRangeEnd] = useState(toDate)
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

  const formatAmount = (value: number) => `${value.toLocaleString('sr-RS')} ${currency}`
  const formatAbsAmount = (value: number) => `${Math.abs(value).toLocaleString('sr-RS')} ${currency}`
  const canEditClubCurrency = user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'sekretar'
  const selectableYears = Array.from({ length: 61 }, (_, i) => currentYear + 5 - i)
  const monthOptions = [
    { value: 1, label: 'Januar' },
    { value: 2, label: 'Februar' },
    { value: 3, label: 'Mart' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Maj' },
    { value: 6, label: 'Jun' },
    { value: 7, label: 'Jul' },
    { value: 8, label: 'Avgust' },
    { value: 9, label: 'Septembar' },
    { value: 10, label: 'Oktobar' },
    { value: 11, label: 'Novembar' },
    { value: 12, label: 'Decembar' },
  ]

  const daysInMonth = (year: number, month1to12: number) => new Date(year, month1to12, 0).getDate()
  const periodLabel = `${formatDateShort(fromDate)} - ${formatDateShort(toDate)}`

  const normalizeCurrency = (raw: unknown): CurrencyCode => {
    const val = typeof raw === 'string' ? raw.toUpperCase().trim() : ''
    if (val === 'BAM' || val === 'HRK' || val === 'EUR') return val
    return 'RSD'
  }

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
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('errors.load')
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
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('errors.load')
      setError(msg)
    } finally {
      setClanarineLoading(false)
    }
  }

  const fetchClubCurrency = useCallback(async () => {
    if (!user) return
    try {
      const res = await api.get<KlubCurrencyResponse>('/api/klub')
      const nextCurrency = normalizeCurrency(res.data?.klub?.valuta)
      setCurrency(nextCurrency)
    } catch {
      setCurrency('RSD')
    }
  }, [user])

  useEffect(() => {
    fetchClubCurrency()
  }, [fetchClubCurrency])

  useEffect(() => {
    if (tab === 'dashboard') fetchDashboard()
    else if (tab === 'clanarine') fetchClanarine()
  }, [tab, fromDate, toDate, clanarineGodina])

  const handleCurrencyChange = async (nextValue: string) => {
    const nextCurrency = normalizeCurrency(nextValue)
    if (nextCurrency === currency) return
    setCurrency(nextCurrency)
    if (!canEditClubCurrency) return
    setCurrencySaving(true)
    setError('')
    try {
      await api.patch('/api/klub', { valuta: nextCurrency })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('errors.save')
      setError(msg)
      await fetchClubCurrency()
    } finally {
      setCurrencySaving(false)
    }
  }

  const applyDateSelection = () => {
    if (datePickType === 'day') {
      setFromDate(dayValue)
      setToDate(dayValue)
      setDateModalOpen(false)
      return
    }
    if (datePickType === 'month') {
      const start = `${monthYear.year}-${String(monthYear.month).padStart(2, '0')}-01`
      const end = `${monthYear.year}-${String(monthYear.month).padStart(2, '0')}-${String(daysInMonth(monthYear.year, monthYear.month)).padStart(2, '0')}`
      setFromDate(start)
      setToDate(end)
      setDateModalOpen(false)
      return
    }
    if (datePickType === 'year') {
      setFromDate(`${yearValue}-01-01`)
      setToDate(`${yearValue}-12-31`)
      setDateModalOpen(false)
      return
    }
    if (!rangeStart || !rangeEnd) {
      setError('Izaberi početni i završni datum.')
      return
    }
    if (rangeStart > rangeEnd) {
      setError('Početni datum mora biti pre završnog.')
      return
    }
    setFromDate(rangeStart)
    setToDate(rangeEnd)
    setDateModalOpen(false)
  }

  const handleNovaTransakcija = async (e: React.FormEvent) => {
    e.preventDefault()
    const iznos = Number(transakcijaIznos?.replace(/,/g, '.'))
    if (!iznos || iznos <= 0) {
      setError(t('errors.invalidAmount'))
      return
    }
    if (transakcijaDatum > todayYmd) {
      setError(t('errors.futureDate'))
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
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('errors.save')
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
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('errors.generic')
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
      label: t('tabs.dashboard'),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
    {
      key: 'clanarine',
      label: t('tabs.memberships'),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      key: 'transakcije',
      label: t('tabs.transactions'),
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
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">{t('title')}</h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 ml-3.5 max-w-xl">
              {t('subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEditClubCurrency ? (
              <Dropdown
                aria-label={t('currency.ariaLabel')}
                options={[
                  { value: 'RSD', label: 'RSD' },
                  { value: 'BAM', label: 'BAM' },
                  { value: 'HRK', label: 'HRK' },
                  { value: 'EUR', label: 'EUR' },
                ]}
                value={currency}
                onChange={handleCurrencyChange}
                minTriggerWidth="110px"
                className="[&_button]:min-h-[38px] [&_button]:rounded-xl [&_button]:border-gray-200 [&_button]:shadow-sm [&_button]:hover:bg-gray-50"
              />
            ) : (
              <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm min-w-[110px] justify-center">
                {currency}
              </div>
            )}
            {currencySaving && (
              <span className="text-[11px] text-gray-500">{t('common.saving')}</span>
            )}
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
                    currency,
                  })
                }
                title={t('pdf.printTitle')}
                aria-label={t('pdf.printAria')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all"
              >
                <PrinterIcon className="w-4 h-4" />
                {t('pdf.report')}
              </button>
            )}
          </div>
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

        {dateModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl">
              <div className="border-b border-gray-100 px-5 py-4">
                <h3 className="text-base font-bold text-gray-900">Izbor datuma izveštaja</h3>
                <p className="mt-1 text-xs text-gray-500">Izaberi tip perioda pa unesi datum(e) jednostavno kroz padajuće liste.</p>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tip perioda</label>
                  <Dropdown
                    options={[
                      { value: 'day', label: 'Dan' },
                      { value: 'month', label: 'Mesec' },
                      { value: 'year', label: 'Godina' },
                      { value: 'range', label: 'Period' },
                    ]}
                    value={datePickType}
                    onChange={(v) => setDatePickType(v as DatePickType)}
                    fullWidth
                  />
                </div>

                {datePickType === 'day' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Odaberi dan</label>
                    <DatePartsSelect
                      value={dayValue}
                      onChange={setDayValue}
                      placeholderDay="Dan"
                      placeholderMonth="Mesec"
                      placeholderYear="Godina"
                      maxYear={currentYear + 5}
                    />
                  </div>
                )}

                {datePickType === 'month' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Godina</label>
                      <select
                        className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        value={monthYear.year}
                        onChange={(e) => setMonthYear((p) => ({ ...p, year: Number(e.target.value) }))}
                      >
                        {selectableYears.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Mesec</label>
                      <select
                        className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        value={monthYear.month}
                        onChange={(e) => setMonthYear((p) => ({ ...p, month: Number(e.target.value) }))}
                      >
                        {monthOptions.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {datePickType === 'year' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Godina</label>
                    <select
                      className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      value={yearValue}
                      onChange={(e) => setYearValue(Number(e.target.value))}
                    >
                      {selectableYears.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}

                {datePickType === 'range' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Početni datum</label>
                      <DatePartsSelect
                        value={rangeStart}
                        onChange={setRangeStart}
                        placeholderDay="Dan"
                        placeholderMonth="Mesec"
                        placeholderYear="Godina"
                        maxYear={currentYear + 5}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Završni datum</label>
                      <DatePartsSelect
                        value={rangeEnd}
                        onChange={setRangeEnd}
                        placeholderDay="Dan"
                        placeholderMonth="Mesec"
                        placeholderYear="Godina"
                        maxYear={currentYear + 5}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setDateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Otkaži
                </button>
                <button
                  type="button"
                  onClick={applyDateSelection}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300"
                >
                  Primeni
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ DASHBOARD TAB ══════════ */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {/* Period controls */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{t('period.title')}</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {t('period.subtitle')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Dropdown
                    aria-label={t('filters.transactionsAria')}
                    options={[
                      { value: 'sve', label: t('filters.allTransactions') },
                      { value: 'uplata', label: t('filters.onlyIncome') },
                      { value: 'isplata', label: t('filters.onlyExpense') },
                    ]}
                    value={transakcijaFilter}
                    onChange={(v) => setTransakcijaFilter(v as TransakcijaFilter)}
                    minTriggerWidth="170px"
                    className="[&_button]:min-h-[38px] [&_button]:rounded-xl [&_button]:border-gray-200 [&_button]:shadow-sm [&_button]:hover:bg-gray-50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-gray-500 font-semibold text-[11px] uppercase tracking-wider">Odabrani period</span>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRangeStart(fromDate)
                      setRangeEnd(toDate)
                      setDayValue(fromDate)
                      setDateModalOpen(true)
                    }}
                    className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/40 transition-all"
                  >
                    Odaberi datum
                  </button>
                  <span className="text-sm text-gray-600 font-medium">{periodLabel}</span>
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
                      value={formatAmount(dashboardData.saldo)}
                      label={t('summary.balance')}
                      accent={dashboardData.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}
                    />
                    <SummaryCell
                      icon={
                        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      }
                      iconBg="bg-green-50"
                      value={formatAmount(dashboardData.uplate)}
                      label={t('summary.income')}
                      accent="text-green-600"
                    />
                    <SummaryCell
                      icon={
                        <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                        </svg>
                      }
                      iconBg="bg-rose-50"
                      value={formatAmount(dashboardData.isplate)}
                      label={t('summary.expense')}
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
                    <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">{t('transactions.inPeriod')}</h2>
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
                      text={t('transactions.empty')}
                      sub={t('transactions.emptySub')}
                    />
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      {/* Desktop table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                          <thead>
                            <tr className="bg-gray-50/80">
                              <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('transactions.table.date')}</th>
                              <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('transactions.table.type')}</th>
                              <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('transactions.table.amount')}</th>
                              <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('transactions.table.description')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {paginatedTransakcije.map((tx) => (
                              <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-5 py-3.5 text-sm text-gray-600 font-medium">{formatDateShort(tx.datum)}</td>
                                <td className="px-5 py-3.5">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                      tx.tip === 'uplata' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                    }`}
                                  >
                                    {tx.tip === 'uplata' ? t('transactions.type.income') : t('transactions.type.expense')}
                                  </span>
                                  {tx.clanarinaKorisnik && (
                                    <span className="ml-2 text-xs text-gray-400">
                                      ({tx.clanarinaKorisnik.fullName || tx.clanarinaKorisnik.username})
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">
                                  {formatAbsAmount(tx.iznos)}
                                </td>
                                <td className="px-5 py-3.5 text-sm text-gray-500 max-w-[12rem] sm:max-w-[16rem]">
                                  <span className="block truncate" title={tx.opis || undefined}>
                                    {tx.opis || t('common.emptyValue')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile cards */}
                      <div className="sm:hidden divide-y divide-gray-50">
                        {paginatedTransakcije.map((tx) => (
                          <div key={tx.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                            <div className="flex justify-between items-start gap-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                  tx.tip === 'uplata' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {tx.tip === 'uplata' ? t('transactions.type.income') : t('transactions.type.expense')}
                              </span>
                              <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                                {formatAbsAmount(tx.iznos)}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 font-medium mt-1.5">{formatDateShort(tx.datum)}</p>
                            <p className="text-sm text-gray-600 mt-1 truncate max-w-full" title={tx.opis || undefined}>
                              {tx.opis || t('common.emptyValue')}
                            </p>
                            {tx.clanarinaKorisnik && (
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                ({tx.clanarinaKorisnik.fullName || tx.clanarinaKorisnik.username})
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <Pagination
                          currentPage={safeCurrentPage}
                          totalPages={totalPages}
                          onPageChange={setCurrentPage}
                          prevLabel={t('pagination.previous')}
                          nextLabel={t('pagination.next')}
                          prevAria={t('pagination.previousAria')}
                          nextAria={t('pagination.nextAria')}
                          pageAria={t('pagination.pageAria')}
                          pageOf={t('pagination.pageOf', { currentPage: safeCurrentPage, totalPages })}
                        />
                      )}
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
                      <h3 className="text-sm font-bold text-gray-900">{t('newTransaction.title')}</h3>
                      <p className="text-[11px] text-gray-500">{t('newTransaction.subtitle')}</p>
                    </div>
                  </div>

                  <form onSubmit={handleNovaTransakcija} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t('newTransaction.type')}</label>
                      <Dropdown
                        options={[
                          { value: 'uplata', label: t('transactions.type.income') },
                          { value: 'isplata', label: t('transactions.type.expense') },
                        ]}
                        value={transakcijaTip}
                        onChange={(v) => setTransakcijaTip(v as 'uplata' | 'isplata')}
                        fullWidth
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        {transakcijaTip === 'uplata' ? t('newTransaction.payerOptional') : t('newTransaction.payeeOptional')}
                      </label>
                      <input
                        type="text"
                        value={transakcijaUplatilac}
                        onChange={(e) => setTransakcijaUplatilac(e.target.value)}
                        placeholder={transakcijaTip === 'uplata' ? t('newTransaction.payerPlaceholder') : t('newTransaction.payeePlaceholder')}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t('newTransaction.amountRequired', { currency })}</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={transakcijaIznos}
                        onChange={(e) => setTransakcijaIznos(e.target.value.replace(/[^0-9,.]/g, ''))}
                        placeholder={t('newTransaction.amountPlaceholder')}
                        required
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t('newTransaction.dateRequired')}</label>
                      <CalendarDropdown
                        value={transakcijaDatum}
                        onChange={setTransakcijaDatum}
                        placeholder={t('newTransaction.chooseDate')}
                        maxDate={todayYmd}
                        fullWidth
                        aria-label={t('newTransaction.dateAria')}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t('newTransaction.descriptionOptional')}</label>
                      <input
                        type="text"
                        value={transakcijaOpis}
                        onChange={(e) => setTransakcijaOpis(e.target.value)}
                        placeholder={t('newTransaction.descriptionPlaceholder')}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={transakcijaSubmitting}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {transakcijaSubmitting ? t('common.saving') : t('newTransaction.save')}
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
                {t('memberships.info')}
              </p>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
              <div className="flex flex-wrap gap-4 sm:gap-6 items-end">
                <div className="space-y-1.5">
                  <span className="block text-gray-500 font-semibold text-[11px] uppercase tracking-wider">{t('memberships.year')}</span>
                  <Dropdown
                    aria-label={t('memberships.yearAria')}
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
                  <span className="block text-gray-500 font-semibold text-[11px] uppercase tracking-wider">{t('memberships.amount', { currency })}</span>
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
                text={t('memberships.noUsers')}
                sub={t('memberships.noUsersSub')}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead>
                      <tr className="bg-gray-50/80">
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('memberships.table.user')}</th>
                        <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('memberships.table.status')}</th>
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
                                {t('memberships.paid')}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePlati(row.id)}
                                disabled={platiLoading === row.id}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {platiLoading === row.id ? t('memberships.waiting') : t('memberships.pay')}
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
                            {t('memberships.paid')}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePlati(row.id)}
                            disabled={platiLoading === row.id}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {platiLoading === row.id ? '...' : t('memberships.pay')}
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

function Pagination({ currentPage, totalPages, onPageChange, prevLabel, nextLabel, prevAria, nextAria, pageAria, pageOf }: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  prevLabel: string
  nextLabel: string
  prevAria: string
  nextAria: string
  pageAria: string
  pageOf: string
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
          aria-label={prevAria}
          className="shrink-0 inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">{prevLabel}</span>
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
                aria-label={`${pageAria} ${page}`}
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
          aria-label={nextAria}
          className="shrink-0 inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100"
        >
          <span className="hidden sm:inline">{nextLabel}</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <p className="text-center text-[11px] text-gray-400 font-medium mt-2 sm:mt-2.5">{pageOf}</p>
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
