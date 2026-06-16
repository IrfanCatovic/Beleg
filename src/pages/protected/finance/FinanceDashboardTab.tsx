import Dropdown from '../../../components/Dropdown'
import Loader from '../../../components/Loader'
import { formatDateShort } from '../../../utils/dateUtils'
import { useTranslation } from 'react-i18next'
import type { FinanceData } from './useFinanceData'
import type { TransakcijaFilter } from './financeTypes'
import { EmptyState, Pagination, SummaryCell } from './financeUi'

type Props = Pick<
  FinanceData,
  | 'dashboardData'
  | 'dashboardLoading'
  | 'periodLabel'
  | 'activeDateModeLabel'
  | 'transakcijaFilter'
  | 'setTransakcijaFilter'
  | 'openDateModal'
  | 'formatAmount'
  | 'formatAbsAmount'
  | 'canDeleteTransactions'
  | 'filteredTransakcije'
  | 'paginatedTransakcije'
  | 'totalPages'
  | 'safeCurrentPage'
  | 'setCurrentPage'
  | 'deleteLoadingId'
  | 'handleDeleteTransakcija'
>

export default function FinanceDashboardTab({
  dashboardData,
  dashboardLoading,
  periodLabel,
  activeDateModeLabel,
  transakcijaFilter,
  setTransakcijaFilter,
  openDateModal,
  formatAmount,
  formatAbsAmount,
  canDeleteTransactions,
  filteredTransakcije,
  paginatedTransakcije,
  totalPages,
  safeCurrentPage,
  setCurrentPage,
  deleteLoadingId,
  handleDeleteTransakcija,
}: Props) {
  const { t } = useTranslation('finance')

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">{t('period.title')}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">{periodLabel}</p>
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

        <div className="rounded-[24px] border border-gray-200 bg-gray-50/70 p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                Odaberi period
              </span>
              <div className="mt-2 text-lg font-bold tracking-tight text-gray-900">{periodLabel}</div>
              <div className="mt-2 inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                Tip pregleda: <span className="ml-1 font-semibold text-gray-900">{activeDateModeLabel}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={openDateModal}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                Odaberi datum
              </button>
            </div>
          </div>
        </div>
      </div>

      {dashboardLoading ? (
        <Loader />
      ) : dashboardData ? (
        <>
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

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
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
              <div className="text-xs font-medium text-gray-500">
                Filter: <span className="font-semibold text-gray-700">{transakcijaFilter === 'sve' ? t('filters.allTransactions') : transakcijaFilter === 'uplata' ? t('filters.onlyIncome') : t('filters.onlyExpense')}</span>
              </div>
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
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead>
                      <tr className="bg-gray-50/80">
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('transactions.table.date')}</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('transactions.table.type')}</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('transactions.table.amount')}</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('transactions.table.description')}</th>
                        {canDeleteTransactions && (
                          <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Akcija</th>
                        )}
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
                          {canDeleteTransactions && (
                            <td className="px-5 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteTransakcija(tx)}
                                disabled={deleteLoadingId === tx.id}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-all hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deleteLoadingId === tx.id ? '...' : 'Obriši'}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

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
                      {canDeleteTransactions && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => handleDeleteTransakcija(tx)}
                            disabled={deleteLoadingId === tx.id}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-all hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deleteLoadingId === tx.id ? '...' : 'Obriši'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

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
  )
}
