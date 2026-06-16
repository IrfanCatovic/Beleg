import Dropdown from '../../components/Dropdown'
import DatePartsSelect from '../../components/DatePartsSelect'
import { generateFinanceReportPdf } from '../../utils/generateFinanceReportPdf'
import { PrinterIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'
import { useFinanceData } from './finance/useFinanceData'
import FinanceDashboardTab from './finance/FinanceDashboardTab'
import FinanceMembershipsTab from './finance/FinanceMembershipsTab'
import FinanceTransactionsTab from './finance/FinanceTransactionsTab'
import type { DatePickType, Tab } from './finance/financeTypes'

export default function Finance() {
  const { t } = useTranslation('finance')
  const finance = useFinanceData()

  if (!finance.user) return null

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

        <div className="flex flex-col gap-4 rounded-[28px] border border-emerald-100/80 bg-gradient-to-br from-white via-white to-emerald-50/60 p-5 shadow-[0_16px_40px_-30px_rgba(16,185,129,0.35)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">{t('title')}</h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 ml-3.5 max-w-xl">
              {t('subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {finance.canEditClubCurrency ? (
              <Dropdown
                aria-label={t('currency.ariaLabel')}
                options={[
                  { value: 'RSD', label: 'RSD' },
                  { value: 'BAM', label: 'BAM' },
                  { value: 'HRK', label: 'HRK' },
                  { value: 'EUR', label: 'EUR' },
                ]}
                value={finance.currency}
                onChange={finance.handleCurrencyChange}
                minTriggerWidth="110px"
                className="[&_button]:min-h-[38px] [&_button]:rounded-xl [&_button]:border-gray-200 [&_button]:shadow-sm [&_button]:hover:bg-gray-50"
              />
            ) : (
              <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm min-w-[110px] justify-center">
                {finance.currency}
              </div>
            )}
            {finance.currencySaving && (
              <span className="text-[11px] text-gray-500">{t('common.saving')}</span>
            )}
            {finance.dashboardData && finance.tab === 'dashboard' && (
              <button
                type="button"
                onClick={() =>
                  generateFinanceReportPdf({
                    from: finance.fromDate,
                    to: finance.toDate,
                    transakcije: finance.filteredTransakcije,
                    uplate: finance.reportUplate,
                    isplate: finance.reportIsplate,
                    saldo: finance.reportSaldo,
                    currency: finance.currency,
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

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex divide-x divide-gray-100">
            {tabs.map((tabItem) => (
              <button
                key={tabItem.key}
                type="button"
                onClick={() => finance.setTab(tabItem.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 sm:py-4 text-xs sm:text-sm font-semibold transition-all ${
                  finance.tab === tabItem.key
                    ? 'text-emerald-600 bg-emerald-50/60'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/60'
                }`}
              >
                <span className={`${finance.tab === tabItem.key ? 'text-emerald-500' : 'text-gray-400'}`}>{tabItem.icon}</span>
                <span className="hidden sm:inline">{tabItem.label}</span>
                <span className="sm:hidden">{tabItem.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {finance.error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white flex-shrink-0">!</span>
            <span>{finance.error}</span>
          </div>
        )}

        {finance.dateModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4">
            <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_32px_100px_-24px_rgba(15,23,42,0.45)]">
              <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">Odaberi period</h3>
                    <p className="mt-1 text-sm text-slate-500">Izaberi tip i datum za pregled finansija.</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    {finance.activeDateModeLabel}
                  </span>
                </div>
              </div>

              <div className="space-y-5 px-5 py-5 sm:px-6">
                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Tip perioda</label>
                  <Dropdown
                    options={[
                      { value: 'day', label: 'Dan' },
                      { value: 'month', label: 'Mesec' },
                      { value: 'year', label: 'Godina' },
                      { value: 'range', label: 'Period' },
                    ]}
                    value={finance.datePickType}
                    onChange={(v) => finance.setDatePickType(v as DatePickType)}
                    fullWidth
                  />
                  <p className="mt-2.5 text-xs leading-5 text-gray-500">{finance.quickSelectionHint}</p>
                </div>

                {finance.datePickType === 'day' && (
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Odaberi dan</label>
                    <DatePartsSelect
                      value={finance.dayValue}
                      onChange={finance.setDayValue}
                      placeholderDay="Dan"
                      placeholderMonth="Mesec"
                      placeholderYear="Godina"
                      maxYear={finance.currentYear + 5}
                    />
                    <button
                      type="button"
                      onClick={finance.applyTodayInModal}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700 transition-all hover:bg-emerald-100"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Danas
                    </button>
                  </div>
                )}

                {finance.datePickType === 'month' && (
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <label className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Odaberi mesec</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Godina</label>
                        <select
                          className="min-h-[46px] w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-800 shadow-sm transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                          value={finance.monthYear.year}
                          onChange={(e) => finance.setMonthYear((p) => ({ ...p, year: Number(e.target.value) }))}
                        >
                          {finance.selectableYears.map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Mesec</label>
                        <select
                          className="min-h-[46px] w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-800 shadow-sm transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                          value={finance.monthYear.month}
                          onChange={(e) => finance.setMonthYear((p) => ({ ...p, month: Number(e.target.value) }))}
                        >
                          {finance.monthOptions.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {finance.datePickType === 'year' && (
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Odaberi godinu</label>
                    <select
                      className="min-h-[46px] w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-800 shadow-sm transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      value={finance.yearValue}
                      onChange={(e) => finance.setYearValue(Number(e.target.value))}
                    >
                      {finance.selectableYears.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}

                {finance.datePickType === 'range' && (
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Odaberi period</label>
                      <span className="text-[11px] font-medium text-gray-400">Od - do</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Početni datum</label>
                        <DatePartsSelect
                          value={finance.rangeStart}
                          onChange={finance.setRangeStart}
                          placeholderDay="Dan"
                          placeholderMonth="Mesec"
                          placeholderYear="Godina"
                          maxYear={finance.currentYear + 5}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Završni datum</label>
                        <DatePartsSelect
                          value={finance.rangeEnd}
                          onChange={finance.setRangeEnd}
                          placeholderDay="Dan"
                          placeholderMonth="Mesec"
                          placeholderYear="Godina"
                          maxYear={finance.currentYear + 5}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={() => finance.setDateModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl text-sm font-semibold border border-gray-200 bg-white text-gray-600 shadow-sm transition-all hover:bg-gray-50"
                >
                  Otkaži
                </button>
                <button
                  type="button"
                  onClick={finance.applyDateSelection}
                  className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 hover:from-emerald-400 hover:via-emerald-500 hover:to-teal-400"
                >
                  Primeni
                </button>
              </div>
            </div>
          </div>
        )}

        {finance.pendingDeleteTx && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4">
            <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_32px_100px_-24px_rgba(15,23,42,0.45)]">
              <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                  Da li želite da izbrišete transakciju?
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {finance.pendingDeleteTx.tip === 'uplata' && finance.pendingDeleteTx.clanarinaKorisnikId
                    ? 'Brisanjem uplate članarine korisnik se vraća na status da nije platio članarinu.'
                    : 'Ova akcija će trajno ukloniti stavku iz istorije.'}
                </p>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={() => finance.setPendingDeleteTx(null)}
                  disabled={finance.deleteLoadingId === finance.pendingDeleteTx.id}
                  className="px-4 py-2.5 rounded-2xl text-sm font-semibold border border-gray-200 bg-white text-gray-600 shadow-sm transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Otkaži
                </button>
                <button
                  type="button"
                  onClick={finance.confirmDeleteTransakcija}
                  disabled={finance.deleteLoadingId === finance.pendingDeleteTx.id}
                  className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition-all bg-gradient-to-r from-rose-500 via-rose-500 to-red-500 hover:from-rose-400 hover:via-rose-500 hover:to-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {finance.deleteLoadingId === finance.pendingDeleteTx.id ? 'Brisanje...' : 'Obriši'}
                </button>
              </div>
            </div>
          </div>
        )}

        {finance.tab === 'dashboard' && (
          <FinanceDashboardTab
            dashboardData={finance.dashboardData}
            dashboardLoading={finance.dashboardLoading}
            periodLabel={finance.periodLabel}
            activeDateModeLabel={finance.activeDateModeLabel}
            transakcijaFilter={finance.transakcijaFilter}
            setTransakcijaFilter={finance.setTransakcijaFilter}
            openDateModal={finance.openDateModal}
            formatAmount={finance.formatAmount}
            formatAbsAmount={finance.formatAbsAmount}
            canDeleteTransactions={finance.canDeleteTransactions}
            filteredTransakcije={finance.filteredTransakcije}
            paginatedTransakcije={finance.paginatedTransakcije}
            totalPages={finance.totalPages}
            safeCurrentPage={finance.safeCurrentPage}
            setCurrentPage={finance.setCurrentPage}
            deleteLoadingId={finance.deleteLoadingId}
            handleDeleteTransakcija={finance.handleDeleteTransakcija}
          />
        )}

        {finance.tab === 'transakcije' && (
          <FinanceTransactionsTab
            currency={finance.currency}
            todayYmd={finance.todayYmd}
            transakcijaTip={finance.transakcijaTip}
            setTransakcijaTip={finance.setTransakcijaTip}
            transakcijaIznos={finance.transakcijaIznos}
            setTransakcijaIznos={finance.setTransakcijaIznos}
            transakcijaDatum={finance.transakcijaDatum}
            setTransakcijaDatum={finance.setTransakcijaDatum}
            transakcijaUplatilac={finance.transakcijaUplatilac}
            setTransakcijaUplatilac={finance.setTransakcijaUplatilac}
            transakcijaOpis={finance.transakcijaOpis}
            setTransakcijaOpis={finance.setTransakcijaOpis}
            transakcijaSubmitting={finance.transakcijaSubmitting}
            handleNovaTransakcija={finance.handleNovaTransakcija}
          />
        )}

        {finance.tab === 'clanarine' && (
          <FinanceMembershipsTab
            currency={finance.currency}
            currentYear={finance.currentYear}
            clanarine={finance.clanarine}
            clanarineLoading={finance.clanarineLoading}
            clanarineGodina={finance.clanarineGodina}
            setClanarineGodina={finance.setClanarineGodina}
            clanarinaIznosDraft={finance.clanarinaIznosDraft}
            setClanarinaIznosDraft={finance.setClanarinaIznosDraft}
            clanarinaSaving={finance.clanarinaSaving}
            handlePromeniClanarinu={finance.handlePromeniClanarinu}
            platiLoading={finance.platiLoading}
            handlePlati={finance.handlePlati}
          />
        )}
      </div>
    </div>
  )
}
