import { Link } from 'react-router-dom'
import type { TFunction } from 'i18next'
import { TrashIcon } from '@heroicons/react/24/outline'
import { formatDate, formatDateTime } from '../../../utils/dateUtils'
import { transakcijaTipLabel, type TransPayload } from './notificationDetailTypes'

interface LinkedTransactionSectionProps {
  trans: TransPayload
  canDelete: boolean
  t: TFunction
  onDelete: (tx: TransPayload) => void
}

export function LinkedTransactionSection({ trans, canDelete, t, onDelete }: LinkedTransactionSectionProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400" />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125H18.75v-.75m0 0h.375a1.125 1.125 0 001.125-1.125v-9.75c0-.621-.504-1.125-1.125-1.125h-.375m0 12.75h-9.281c-.53 0-1.04-.21-1.414-.586l-6.102-6.102a1.125 1.125 0 010-1.591l6.102-6.102A2.25 2.25 0 0112.562 3h9.281a1.125 1.125 0 011.125 1.125v9.281c0 .53-.21 1.04-.586 1.414l-6.102 6.102a1.125 1.125 0 01-1.591 0z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {t('notificationDetails:cashTransaction')}
              </p>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {t(`notificationDetails:transactionType.${transakcijaTipLabel(trans.tip)}`)}
              </p>
            </div>
          </div>
          <span
            className={`flex-shrink-0 inline-flex text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
              trans.tip === 'uplata'
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                : 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
            }`}
          >
            {trans.tip === 'uplata' ? t('notificationDetails:income') : t('notificationDetails:expense')}
          </span>
        </div>
        <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight tabular-nums">
          {trans.tip === 'isplata' ? '−' : '+'}
          {Math.abs(trans.iznos).toLocaleString('sr-RS')}{' '}
          <span className="text-lg font-bold text-gray-500">{t('notificationDetails:currencyRsd')}</span>
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 text-sm">
          <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-3.5 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
              {t('notificationDetails:date')}
            </p>
            <p className="font-medium text-gray-900">{formatDate(trans.datum)}</p>
          </div>
          {(trans.korisnik?.fullName || trans.korisnik?.username) && (
            <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-3.5 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                {t('notificationDetails:recordedBy')}
              </p>
              <p className="font-medium text-gray-900 truncate">
                {trans.korisnik?.fullName || trans.korisnik?.username}
              </p>
            </div>
          )}
          {trans.clanarinaKorisnik && (
            <div className="rounded-xl bg-emerald-50/50 border border-emerald-100/80 px-3.5 py-2.5 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600/80 mb-0.5">
                {t('notificationDetails:membershipMember')}
              </p>
              <p className="font-medium text-gray-900">
                {trans.clanarinaKorisnik.fullName || trans.clanarinaKorisnik.username}
              </p>
            </div>
          )}
        </div>
        <div className="mt-4 rounded-xl border border-gray-100 bg-white px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
            {t('notificationDetails:descriptionNote')}
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {trans.opis?.trim() ? trans.opis : t('notificationDetails:empty')}
          </p>
        </div>
        {trans.createdAt && (
          <p className="mt-3 text-xs text-gray-400">
            {t('notificationDetails:recordedAt')}: {formatDateTime(trans.createdAt)}
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-100">
          <Link
            to="/finansije"
            className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            {t('notificationDetails:openFinances')}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(trans)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
            >
              <TrashIcon className="h-4 w-4" aria-hidden />
              {t('notificationDetails:deleteTransaction')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
