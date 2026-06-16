import Dropdown from '../../../components/Dropdown'
import Loader from '../../../components/Loader'
import { useTranslation } from 'react-i18next'
import type { FinanceData } from './useFinanceData'
import { EmptyState } from './financeUi'

type Props = Pick<
  FinanceData,
  | 'currency'
  | 'currentYear'
  | 'clanarine'
  | 'clanarineLoading'
  | 'clanarineGodina'
  | 'setClanarineGodina'
  | 'clanarinaIznosDraft'
  | 'setClanarinaIznosDraft'
  | 'clanarinaSaving'
  | 'handlePromeniClanarinu'
  | 'platiLoading'
  | 'handlePlati'
>

export default function FinanceMembershipsTab({
  currency,
  currentYear,
  clanarine,
  clanarineLoading,
  clanarineGodina,
  setClanarineGodina,
  clanarinaIznosDraft,
  setClanarinaIznosDraft,
  clanarinaSaving,
  handlePromeniClanarinu,
  platiLoading,
  handlePlati,
}: Props) {
  const { t } = useTranslation('finance')

  return (
    <div className="space-y-6">
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

      <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-4 sm:p-5">
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
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={clanarinaIznosDraft}
                onChange={(e) => setClanarinaIznosDraft(e.target.value.replace(/[^0-9,.]/g, ''))}
                className="w-24 sm:w-28 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
              />
              <button
                type="button"
                onClick={handlePromeniClanarinu}
                disabled={clanarinaSaving}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {clanarinaSaving ? '...' : 'Promeni članarinu'}
              </button>
            </div>
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
  )
}
