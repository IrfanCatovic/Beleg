import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../context/AuthContext'
import {
  createClanarina,
  createTransakcija,
  deleteTransakcija,
  fetchClanarine as fetchClanarineApi,
  fetchFinansijeDashboard,
} from '../../../services/finansije'
import { fetchKlub, updateKlub } from '../../../services/club'
import { dateToYMD, formatDateShort } from '../../../utils/dateUtils'
import { getApiErrorMessage } from '../../../utils/apiError'
import type {
  ClanarinaRow,
  CurrencyCode,
  DashboardData,
  DatePickType,
  Tab,
  Transakcija,
  TransakcijaFilter,
} from './financeTypes'

export const PAGE_SIZE = 5

const normalizeCurrency = (raw: unknown): CurrencyCode => {
  const val = typeof raw === 'string' ? raw.toUpperCase().trim() : ''
  if (val === 'BAM' || val === 'HRK' || val === 'EUR') return val
  return 'RSD'
}

const daysInMonth = (year: number, month1to12: number) => new Date(year, month1to12, 0).getDate()

export function useFinanceData() {
  const { user } = useAuth()
  const { t } = useTranslation('finance')

  const now = new Date()
  const todayYmd = dateToYMD(now)
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentMonthStart = dateToYMD(new Date(currentYear, currentMonth - 1, 1))
  const currentMonthEnd = dateToYMD(new Date(currentYear, currentMonth, 0))

  const [tab, setTab] = useState<Tab>('dashboard')
  const [currency, setCurrency] = useState<CurrencyCode>('RSD')
  const [currencySaving, setCurrencySaving] = useState(false)

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [fromDate, setFromDate] = useState(() => currentMonthStart)
  const [toDate, setToDate] = useState(() => currentMonthEnd)
  const [dateModalOpen, setDateModalOpen] = useState(false)
  const [datePickType, setDatePickType] = useState<DatePickType>('month')
  const [dayValue, setDayValue] = useState(todayYmd)
  const [monthYear, setMonthYear] = useState<{ year: number; month: number }>({ year: currentYear, month: currentMonth })
  const [yearValue, setYearValue] = useState(currentYear)
  const [rangeStart, setRangeStart] = useState(fromDate)
  const [rangeEnd, setRangeEnd] = useState(toDate)
  const [transakcijaFilter, setTransakcijaFilter] = useState<TransakcijaFilter>('sve')

  const [clanarine, setClanarine] = useState<ClanarinaRow[]>([])
  const [clanarineLoading, setClanarineLoading] = useState(false)
  const [clanarineGodina, setClanarineGodina] = useState(Math.max(2026, new Date().getFullYear()))
  const [platiLoading, setPlatiLoading] = useState<number | null>(null)
  const [clanarinaIznos, setClanarinaIznos] = useState(2320)
  const [clanarinaIznosDraft, setClanarinaIznosDraft] = useState('2320')
  const [clanarinaSaving, setClanarinaSaving] = useState(false)
  const [error, setError] = useState('')

  const [transakcijaTip, setTransakcijaTip] = useState<'uplata' | 'isplata'>('uplata')
  const [transakcijaIznos, setTransakcijaIznos] = useState('')
  const [transakcijaDatum, setTransakcijaDatum] = useState(() => dateToYMD(new Date()))
  const [transakcijaUplatilac, setTransakcijaUplatilac] = useState('')
  const [transakcijaOpis, setTransakcijaOpis] = useState('')
  const [transakcijaSubmitting, setTransakcijaSubmitting] = useState(false)
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null)
  const [pendingDeleteTx, setPendingDeleteTx] = useState<Transakcija | null>(null)

  const formatAmount = (value: number) => `${value.toLocaleString('sr-RS')} ${currency}`
  const formatAbsAmount = (value: number) => `${Math.abs(value).toLocaleString('sr-RS')} ${currency}`
  const canEditClubCurrency = user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'sekretar'
  const canDeleteTransactions = user?.role === 'superadmin' || user?.role === 'admin'
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

  const periodLabel = `${formatDateShort(fromDate)} - ${formatDateShort(toDate)}`
  const activeDateModeLabel =
    datePickType === 'day'
      ? 'Dan'
      : datePickType === 'month'
        ? 'Mesec'
        : datePickType === 'year'
          ? 'Godina'
          : 'Period'
  const quickSelectionHint =
    datePickType === 'day'
      ? 'Izaberi jedan dan.'
      : datePickType === 'month'
        ? 'Izaberi godinu i mesec.'
        : datePickType === 'year'
          ? 'Izaberi godinu.'
          : 'Unesi početni i završni datum.'

  const fetchDashboard = async () => {
    if (!user) return
    setDashboardLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate })
      const data = await fetchFinansijeDashboard(params) as DashboardData
      setDashboardData({
        ...data,
        transakcije: Array.isArray(data?.transakcije) ? data.transakcije : [],
      })
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, t('errors.load'))
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
      const data = await fetchClanarineApi(clanarineGodina) as { clanarine?: typeof clanarine }
      setClanarine(data.clanarine || [])
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, t('errors.load'))
      setError(msg)
    } finally {
      setClanarineLoading(false)
    }
  }

  const fetchClubCurrency = useCallback(async () => {
    if (!user) return
    try {
      const klubData = await fetchKlub()
      const nextCurrency = normalizeCurrency(klubData?.valuta)
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
      await updateKlub({ valuta: nextCurrency })
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, t('errors.save'))
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
      await createTransakcija({
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
      const msg = getApiErrorMessage(err, t('errors.save'))
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
      await createClanarina({
        korisnikId,
        iznos: clanarinaIznos,
        datum: today,
      })
      await fetchClanarine()
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, t('errors.generic'))
      setError(msg)
    } finally {
      setPlatiLoading(null)
    }
  }

  const handlePromeniClanarinu = () => {
    const parsed = Number(clanarinaIznosDraft.replace(/,/g, '.'))
    if (!parsed || parsed <= 0) {
      setError('Unesite ispravan iznos članarine.')
      return
    }
    setClanarinaSaving(true)
    setError('')
    setClanarinaIznos(parsed)
    setClanarinaIznosDraft(String(parsed))
    setTimeout(() => setClanarinaSaving(false), 250)
  }

  const handleDeleteTransakcija = (tx: Transakcija) => {
    if (!canDeleteTransactions || deleteLoadingId !== null) return
    setPendingDeleteTx(tx)
  }

  const confirmDeleteTransakcija = async () => {
    if (!pendingDeleteTx) return
    setDeleteLoadingId(pendingDeleteTx.id)
    setError('')
    try {
      await deleteTransakcija(pendingDeleteTx.id)
      await fetchDashboard()
      await fetchClanarine()
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, t('errors.save'))
      setError(msg)
    } finally {
      setDeleteLoadingId(null)
      setPendingDeleteTx(null)
    }
  }

  const filteredTransakcije = dashboardData?.transakcije.filter((tx) => {
    if (transakcijaFilter === 'sve') return true
    return tx.tip === transakcijaFilter
  }) ?? []
  const reportUplate = filteredTransakcije
    .filter((tx) => tx.tip === 'uplata')
    .reduce((sum, tx) => sum + Math.abs(Number(tx.iznos) || 0), 0)
  const reportIsplate = filteredTransakcije
    .filter((tx) => tx.tip === 'isplata')
    .reduce((sum, tx) => sum + Math.abs(Number(tx.iznos) || 0), 0)
  const reportSaldo = reportUplate - reportIsplate

  const totalPages = Math.max(1, Math.ceil(filteredTransakcije.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedTransakcije = filteredTransakcije.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  )

  const handleTabChange = (nextTab: Tab) => {
    setTab(nextTab)
    setCurrentPage(1)
  }

  const openDateModal = () => {
    setRangeStart(fromDate)
    setRangeEnd(toDate)
    setDayValue(fromDate)
    setDateModalOpen(true)
  }

  const applyTodayInModal = () => {
    setDayValue(todayYmd)
    setFromDate(todayYmd)
    setToDate(todayYmd)
    setDateModalOpen(false)
  }

  return {
    user,
    t,
    tab,
    setTab: handleTabChange,
    currency,
    currencySaving,
    canEditClubCurrency,
    canDeleteTransactions,
    handleCurrencyChange,
    dashboardData,
    dashboardLoading,
    fromDate,
    toDate,
    currentPage,
    setCurrentPage,
    currentYear,
    todayYmd,
    dateModalOpen,
    setDateModalOpen,
    datePickType,
    setDatePickType,
    dayValue,
    setDayValue,
    monthYear,
    setMonthYear,
    yearValue,
    setYearValue,
    rangeStart,
    setRangeStart,
    rangeEnd,
    setRangeEnd,
    transakcijaFilter,
    setTransakcijaFilter,
    clanarine,
    clanarineLoading,
    clanarineGodina,
    setClanarineGodina,
    platiLoading,
    clanarinaIznosDraft,
    setClanarinaIznosDraft,
    clanarinaSaving,
    error,
    transakcijaTip,
    setTransakcijaTip,
    transakcijaIznos,
    setTransakcijaIznos,
    transakcijaDatum,
    setTransakcijaDatum,
    transakcijaUplatilac,
    setTransakcijaUplatilac,
    transakcijaOpis,
    setTransakcijaOpis,
    transakcijaSubmitting,
    deleteLoadingId,
    pendingDeleteTx,
    setPendingDeleteTx,
    formatAmount,
    formatAbsAmount,
    selectableYears,
    monthOptions,
    periodLabel,
    activeDateModeLabel,
    quickSelectionHint,
    applyDateSelection,
    handleNovaTransakcija,
    handlePlati,
    handlePromeniClanarinu,
    handleDeleteTransakcija,
    confirmDeleteTransakcija,
    filteredTransakcije,
    reportUplate,
    reportIsplate,
    reportSaldo,
    totalPages,
    safeCurrentPage,
    paginatedTransakcije,
    openDateModal,
    applyTodayInModal,
  }
}

export type FinanceData = ReturnType<typeof useFinanceData>
