import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import Dropdown from '../components/Dropdown'
import CalendarDropdown from '../components/CalendarDropdown'
import { formatDateShort, dateToYMD } from '../utils/dateUtils'
import { generateFinanceReportPdf } from '../utils/generateFinanceReportPdf'
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
  const [fromDate, setFromDate] = useState(() => dateToYMD(new Date(currentYear, 0, 1)))
  const [toDate, setToDate] = useState(() => dateToYMD(new Date(currentYear, 11, 31)))
  const [periodPreset, setPeriodPreset] = useState<'danas' | 'mesec' | 'godina'>('godina')
  const [transakcijaFilter, setTransakcijaFilter] = useState<TransakcijaFilter>('sve')

  const [clanarine, setClanarine] = useState<ClanarinaRow[]>([])
  const [clanarineLoading, setClanarineLoading] = useState(false)
  const [clanarineGodina, setClanarineGodina] = useState(Math.max(2026, new Date().getFullYear()))
  const [platiLoading, setPlatiLoading] = useState<number | null>(null)
  const [clanarinaIznos, setClanarinaIznos] = useState(2320)
  const [error, setError] = useState('')

  // Form za novu transakciju (tab Transakcije)
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
      setDashboardData(res.data)
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

  return (
    <div className="py-4 sm:py-8 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Tabovi – mobil: centrirani, desktop: poravnati levo */}
      <div className="flex justify-center sm:justify-start gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-gray-200 overflow-x-auto sm:overflow-visible pb-px scrollbar-thin">
        <button
          type="button"
          onClick={() => setTab('dashboard')}
          className={`flex-shrink-0 px-3 sm:px-4 py-2 font-medium rounded-t-lg transition-colors whitespace-nowrap ${
            tab === 'dashboard'
              ? 'bg-[#41ac53] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Dashboard
        </button>
        <button
          type="button"
          onClick={() => setTab('clanarine')}
          className={`flex-shrink-0 px-3 sm:px-4 py-2 font-medium rounded-t-lg transition-colors whitespace-nowrap ${
            tab === 'clanarine'
              ? 'bg-[#41ac53] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Članarine
        </button>
        <button
          type="button"
          onClick={() => setTab('transakcije')}
          className={`flex-shrink-0 px-3 sm:px-4 py-2 font-medium rounded-t-lg transition-colors whitespace-nowrap ${
            tab === 'transakcije'
              ? 'bg-[#41ac53] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Uplate / Isplate
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>
      )}

      {tab === 'dashboard' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Kontrole za period, filter i štampu – u jednoj kartici */}
          <div className="bg-white rounded-2xl shadow p-4 sm:p-5 border border-gray-100">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Podešavanje prikaza</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Izaberi period, filter transakcija i po želji odštampaj PDF izveštaj.
                </p>
              </div>
              {/* Filter + štampa – uvijek gore, poravnato jedno do drugog */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Dropdown
                  aria-label="Filter transakcija"
                  options={[
                    { value: 'sve', label: 'Sve transakcije' },
                    { value: 'uplata', label: 'Samo uplate' },
                    { value: 'isplata', label: 'Samo isplate' },
                  ]}
                  value={transakcijaFilter}
                  onChange={(v) => setTransakcijaFilter(v as TransakcijaFilter)}
                  minTriggerWidth="180px"
                  className="[&_button]:min-h-[40px] [&_button]:rounded-xl [&_button]:border-gray-200 [&_button]:shadow-sm [&_button]:hover:bg-gray-50"
                />
                {dashboardData && (
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
                    className="inline-flex items-center justify-center min-h-[40px] min-w-[44px] rounded-xl border border-gray-200 bg-gray-50 text-gray-600 shadow-sm hover:bg-gray-100 hover:border-gray-300 hover:text-gray-800 active:scale-[0.98] transition-all"
                  >
                    <PrinterIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Period + ručni datumi ispod kontrola */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
              {/* Period kao dropdown (danas / mesec / godina) */}
              <div className="space-y-1.5">
                <span className="block text-gray-600 font-medium text-xs">Period</span>
                <Dropdown
                  aria-label="Period finansijskog izveštaja"
                  options={[
                    { value: 'danas', label: 'Danas' },
                    { value: 'mesec', label: 'Ovaj mesec' },
                    { value: 'godina', label: 'Ova godina' },
                  ]}
                  value={periodPreset}
                  onChange={(v) => {
                    const value = v as 'danas' | 'mesec' | 'godina'
                    setPeriodPreset(value)
                    const now = new Date()
                    if (value === 'danas') {
                      const ymd = dateToYMD(now)
                      setFromDate(ymd)
                      setToDate(ymd)
                    } else if (value === 'mesec') {
                      setFromDate(dateToYMD(firstDayOfMonth(now)))
                      setToDate(dateToYMD(lastDayOfMonth(now)))
                    } else {
                      setFromDate(`${currentYear}-01-01`)
                      setToDate(`${currentYear}-12-31`)
                    }
                  }}
                  minTriggerWidth="180px"
                  className="[&_button]:min-h-[40px] [&_button]:w-full [&_button]:rounded-xl [&_button]:border-gray-200 [&_button]:shadow-sm [&_button]:hover:bg-gray-50"
                />
              </div>

              {/* Od / Do */}
              <div className="space-y-1.5 lg:col-span-2">
                <span className="block text-gray-600 font-medium text-xs">Ručni odabir datuma</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-gray-500">Od</span>
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
                    <span className="text-[11px] text-gray-500">Do</span>
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
            <div className="text-center py-12 text-gray-500">Učitavanje...</div>
          ) : dashboardData ? (
            <>
              {/* Karticice: saldo, uplate, isplate */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-white rounded-xl shadow p-4 sm:p-6 border-l-4" style={{ borderLeftColor: '#41ac53' }}>
                  <p className="text-sm text-gray-600">Saldo</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1 break-all" style={{ color: dashboardData.saldo >= 0 ? '#41ac53' : '#dc2626' }}>
                    {dashboardData.saldo.toLocaleString('sr-RS')} RSD
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow p-4 sm:p-6 border-l-4 border-green-500">
                  <p className="text-sm text-gray-600">Uplate</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1 text-green-600 break-all">
                    {dashboardData.uplate.toLocaleString('sr-RS')} RSD
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow p-4 sm:p-6 border-l-4 border-red-500">
                  <p className="text-sm text-gray-600">Isplate</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1 text-red-600 break-all">
                    {dashboardData.isplate.toLocaleString('sr-RS')} RSD
                  </p>
                </div>
              </div>

              {/* Lista transakcija desktop tabela, mobil kartice */}
              <div className="bg-white rounded-xl shadow overflow-hidden">
                <h3 className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 font-semibold text-gray-800 text-sm sm:text-base">
                  Transakcije u periodu
                </h3>
                {filteredTransakcije.length === 0 ? (
                  <p className="p-4 sm:p-6 text-gray-500 text-sm sm:text-base">
                    Nema transakcija za izabrani period i filter.
                  </p>
                ) : (
                  <>
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tip</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Iznos</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opis</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {paginatedTransakcije.map((t) => (
                            <tr key={t.id} className="hover:bg-gray-50">
                              <td className="px-6 py-3 text-sm text-gray-700">{formatDateShort(t.datum)}</td>
                              <td className="px-6 py-3">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium ${
                                    t.tip === 'uplata' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {t.tip}
                                </span>
                                {t.clanarinaKorisnik && (
                                  <span className="ml-2 text-xs text-gray-500">
                                    ({t.clanarinaKorisnik.fullName || t.clanarinaKorisnik.username})
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-3 text-sm font-medium">
                                {t.iznos.toLocaleString('sr-RS')} RSD
                              </td>
                              <td className="px-6 py-3 text-sm text-gray-600">{t.opis || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="sm:hidden divide-y divide-gray-200">
                      {paginatedTransakcije.map((t) => (
                        <div key={t.id} className="p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                t.tip === 'uplata' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {t.tip}
                            </span>
                            <span className="text-sm font-medium whitespace-nowrap">
                              {t.iznos.toLocaleString('sr-RS')} RSD
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{formatDateShort(t.datum)}</p>
                          <p className="text-sm text-gray-700 mt-1">{t.opis || '—'}</p>
                          {t.clanarinaKorisnik && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              ({t.clanarinaKorisnik.fullName || t.clanarinaKorisnik.username})
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-gray-200 text-sm">
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={safeCurrentPage === 1}
                          className="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Prethodne
                        </button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                              key={page}
                              type="button"
                              onClick={() => setCurrentPage(page)}
                              className={`w-8 h-8 rounded-md text-sm font-medium ${
                                page === safeCurrentPage
                                  ? 'bg-[#41ac53] text-white'
                                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safeCurrentPage === totalPages}
                          className="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Sledeće
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {tab === 'transakcije' && (
        <div className="flex justify-center">
          <div className="space-y-4 sm:space-y-6 max-w-xl w-full">
            <div className="bg-white rounded-xl shadow p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Nova transakcija</h3>
            <form onSubmit={handleNovaTransakcija} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tip</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {transakcijaTip === 'uplata' ? 'Ko je uplatio (opciono)' : 'Kome / za šta (opciono)'}
                </label>
                <input
                  type="text"
                  value={transakcijaUplatilac}
                  onChange={(e) => setTransakcijaUplatilac(e.target.value)}
                  placeholder={transakcijaTip === 'uplata' ? 'npr. Ime prezime' : 'npr. Dobavljač, svrha'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-[#41ac53] focus:ring-1 focus:ring-[#41ac53]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Iznos (RSD) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={transakcijaIznos}
                  onChange={(e) => setTransakcijaIznos(e.target.value.replace(/[^0-9,.]/g, ''))}
                  placeholder="npr. 5000"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-[#41ac53] focus:ring-1 focus:ring-[#41ac53]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Opis (opciono)</label>
                <input
                  type="text"
                  value={transakcijaOpis}
                  onChange={(e) => setTransakcijaOpis(e.target.value)}
                  placeholder="npr. Članarina, kupovina opreme..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-[#41ac53] focus:ring-1 focus:ring-[#41ac53]"
                />
              </div>
              <button
                type="submit"
                disabled={transakcijaSubmitting}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-white font-medium transition-colors disabled:opacity-60"
                style={{ backgroundColor: '#41ac53' }}
              >
                {transakcijaSubmitting ? 'Čuvanje...' : 'Sačuvaj transakciju'}
              </button>
            </form>
            </div>
          </div>
        </div>
      )}

      {tab === 'clanarine' && (
        <div className="space-y-4 sm:space-y-6">
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 border border-gray-200">
            Status članarine računa se posebno za svaku godinu. Kada nastupi nova godina, svi članovi su za narednu godinu početno neplaćeni, uplate se evidentiraju tek kada član plati za tu godinu.
          </p>
          <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
            <label className="flex items-center gap-2">
              <span className="text-gray-600 text-sm sm:text-base">Godina:</span>
              <Dropdown
                aria-label="Godina članarine"
                options={Array.from({ length: Math.max(0, currentYear - 2026 + 1) }, (_, i) => 2026 + i)
                  .sort((a, b) => b - a)
                  .map((y) => ({ value: String(y), label: `${y}.` }))}
                value={String(clanarineGodina)}
                onChange={(v) => setClanarineGodina(Number(v))}
                minTriggerWidth="120px"
              />
            </label>
            <label className="flex items-center gap-2 flex-1 sm:flex-initial min-w-0">
              <span className="text-gray-600 text-sm sm:text-base whitespace-nowrap">Iznos članarine (RSD):</span>
              <input
                type="number"
                min={1}
                value={clanarinaIznos}
                onChange={(e) => setClanarinaIznos(Number(e.target.value) || 0)}
                className="w-20 sm:w-24 rounded-lg border border-gray-300 px-3 py-2 focus:border-[#41ac53] focus:ring-1 focus:ring-[#41ac53]"
              />
            </label>
          </div>

          {clanarineLoading ? (
            <div className="text-center py-12 text-gray-500">Učitavanje...</div>
          ) : (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Korisnik</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {clanarine.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          <span className="font-medium text-gray-900">{row.fullName || row.username}</span>
                          {row.fullName && <span className="ml-2 text-sm text-gray-500">@{row.username}</span>}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {row.platio ? (
                            <span className="text-green-600 font-medium">Platio</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handlePlati(row.id)}
                              disabled={platiLoading === row.id}
                              className="px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-60"
                              style={{ backgroundColor: '#41ac53' }}
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
              <div className="sm:hidden divide-y divide-gray-200">
                {clanarine.map((row) => (
                  <div key={row.id} className="p-4 flex justify-between items-center gap-3">
                    <div className="min-w-0">
                      <span className="font-medium text-gray-900 block truncate">{row.fullName || row.username}</span>
                      {row.fullName && <span className="text-sm text-gray-500">@{row.username}</span>}
                    </div>
                    <div className="flex-shrink-0">
                      {row.platio ? (
                        <span className="text-green-600 font-medium">Platio</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePlati(row.id)}
                          disabled={platiLoading === row.id}
                          className="px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-60 text-sm"
                          style={{ backgroundColor: '#41ac53' }}
                        >
                          {platiLoading === row.id ? '...' : 'Plati'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {clanarine.length === 0 && !clanarineLoading && (
                <p className="p-4 sm:p-6 text-gray-500 text-center text-sm sm:text-base">Nema korisnika.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
