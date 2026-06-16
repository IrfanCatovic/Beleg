import Dropdown from '../../../components/Dropdown'
import CalendarDropdown from '../../../components/CalendarDropdown'
import { useTranslation } from 'react-i18next'
import type { FinanceData } from './useFinanceData'

type Props = Pick<
  FinanceData,
  | 'currency'
  | 'todayYmd'
  | 'transakcijaTip'
  | 'setTransakcijaTip'
  | 'transakcijaIznos'
  | 'setTransakcijaIznos'
  | 'transakcijaDatum'
  | 'setTransakcijaDatum'
  | 'transakcijaUplatilac'
  | 'setTransakcijaUplatilac'
  | 'transakcijaOpis'
  | 'setTransakcijaOpis'
  | 'transakcijaSubmitting'
  | 'handleNovaTransakcija'
>

export default function FinanceTransactionsTab({
  currency,
  todayYmd,
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
  handleNovaTransakcija,
}: Props) {
  const { t } = useTranslation('finance')

  return (
    <div className="flex justify-center">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-visible">
          <div className="p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex-shrink-0 h-9 w-9 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{t('newTransaction.title')}</h3>
                  <p className="text-[11px] text-gray-500">{t('newTransaction.subtitle')}</p>
                </div>
              </div>
              <div className="hidden sm:inline-flex rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-600">
                {currency}
              </div>
            </div>

            <form onSubmit={handleNovaTransakcija} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t('newTransaction.descriptionOptional')}</label>
                <input
                  type="text"
                  value={transakcijaOpis}
                  onChange={(e) => setTransakcijaOpis(e.target.value)}
                  placeholder={t('newTransaction.descriptionPlaceholder')}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={transakcijaSubmitting}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {transakcijaSubmitting ? t('common.saving') : t('newTransaction.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
