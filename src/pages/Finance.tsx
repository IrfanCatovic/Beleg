import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import Dropdown from '../components/Dropdown'
import { formatDateShort } from '../utils/dateUtils'

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
  const currentYear = new Date().getFullYear()
  const toYMD = (d: Date) => d.toISOString().slice(0, 10)
  const firstDayOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
  const lastDayOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const [fromDate, setFromDate] = useState(() => toYMD(new Date(currentYear, 0, 1)))
  const [toDate, setToDate] = useState(() => toYMD(new Date(currentYear, 11, 31)))
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
  const [transakcijaDatum, setTransakcijaDatum] = useState(() => toYMD(new Date()))
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
      setTransakcijaDatum(toYMD(new Date()))
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
      const today = new Date().toISOString().slice(0, 10)
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

  return (
    <div className="py-4 sm:py-8 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Tabovi – mobil: scroll ili wrap */}
      <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-gray-200 overflow-x-auto sm:overflow-visible pb-px scrollbar-thin">
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
          {/* Brzi filteri + ručni period + filter tipa – na telefonu sve centrirano */}
          <div className="flex flex-wrap gap-3 sm:gap-4 items-center justify-center sm:justify-start">
            <span className="text-gray-600 font-medium w-full text-center sm:w-auto sm:text-left">Period:</span>
            <button
              type="button"
              onClick={() => {
                const t = new Date()
                setFromDate(toYMD(t))
                setToDate(toYMD(t))
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Danas
            </button>
            <button
              type="button"
              onClick={() => {
                const t = new Date()
                setFromDate(toYMD(firstDayOfMonth(t)))
                setToDate(toYMD(lastDayOfMonth(t)))
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Ovaj mesec
            </button>
            <button
              type="button"
              onClick={() => {
                setFromDate(`${currentYear}-01-01`)
                setToDate(`${currentYear}-12-31`)
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Ova godina
            </button>
            <span className="text-gray-400 hidden sm:inline">|</span>
            <label className="flex items-center gap-2 justify-center sm:justify-start">
              <span className="text-gray-600">Od:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 focus:border-[#41ac53] focus:ring-1 focus:ring-[#41ac53]"
              />
            </label>
            <label className="flex items-center gap-2 justify-center sm:justify-start">
              <span className="text-gray-600">Do:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 focus:border-[#41ac53] focus:ring-1 focus:ring-[#41ac53] w-full sm:w-auto min-w-0"
              />
            </label>
            <span className="text-gray-400 hidden sm:inline">|</span>
            <div className="flex justify-center sm:justify-start">
              <Dropdown
                aria-label="Filter transakcija"
                options={[
                  { value: 'sve', label: 'Sve transakcije' },
                  { value: 'uplata', label: 'Samo uplate' },
                  { value: 'isplata', label: 'Samo isplate' },
                ]}
                value={transakcijaFilter}
                onChange={(v) => setTransakcijaFilter(v as TransakcijaFilter)}
                minTriggerWidth="200px"
              />
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

              {/* Lista transakcija – desktop tabela, mobil kartice */}
              <div className="bg-white rounded-xl shadow overflow-hidden">
                <h3 className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 font-semibold text-gray-800 text-sm sm:text-base">Transakcije u periodu</h3>
                {filteredTransakcije.length === 0 ? (
                  <p className="p-4 sm:p-6 text-gray-500 text-sm sm:text-base">Nema transakcija za izabrani period i filter.</p>
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
                          {filteredTransakcije.map((t) => (
                            <tr key={t.id} className="hover:bg-gray-50">
                              <td className="px-6 py-3 text-sm text-gray-700">{formatDateShort(t.datum)}</td>
                              <td className="px-6 py-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${t.tip === 'uplata' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                  {t.tip}
                                </span>
                                {t.clanarinaKorisnik && (
                                  <span className="ml-2 text-xs text-gray-500">({t.clanarinaKorisnik.fullName || t.clanarinaKorisnik.username})</span>
                                )}
                              </td>
                              <td className="px-6 py-3 text-sm font-medium">{t.iznos.toLocaleString('sr-RS')} RSD</td>
                              <td className="px-6 py-3 text-sm text-gray-600">{t.opis || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="sm:hidden divide-y divide-gray-200">
                      {filteredTransakcije.map((t) => (
                        <div key={t.id} className="p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.tip === 'uplata' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {t.tip}
                            </span>
                            <span className="text-sm font-medium whitespace-nowrap">{t.iznos.toLocaleString('sr-RS')} RSD</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{formatDateShort(t.datum)}</p>
                          <p className="text-sm text-gray-700 mt-1">{t.opis || '—'}</p>
                          {t.clanarinaKorisnik && (
                            <p className="text-xs text-gray-500 mt-0.5">({t.clanarinaKorisnik.fullName || t.clanarinaKorisnik.username})</p>
                          )}
                        </div>
                      ))}
                    </div>
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
                <input
                  type="date"
                  value={transakcijaDatum}
                  onChange={(e) => setTransakcijaDatum(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-[#41ac53] focus:ring-1 focus:ring-[#41ac53]"
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
          <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
            <label className="flex items-center gap-2">
              <span className="text-gray-600 text-sm sm:text-base">Godina:</span>
              <select
                value={clanarineGodina}
                onChange={(e) => setClanarineGodina(Number(e.target.value))}
                className="rounded-lg border border-gray-300 px-3 py-2 focus:border-[#41ac53] focus:ring-1 focus:ring-[#41ac53] w-full sm:w-auto min-w-0"
              >
                {Array.from({ length: Math.max(0, currentYear - 2026 + 1) }, (_, i) => 2026 + i)
                  .sort((a, b) => b - a)
                  .map((y) => (
                    <option key={y} value={y}>{y}.</option>
                  ))}
              </select>
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
