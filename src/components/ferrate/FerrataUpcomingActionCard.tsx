import { UsersIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export type FerrataUpcomingAction = {
  id: number
  naziv: string
  startAt: string
  klubNaziv?: string
  maxLjudi: number
  prijavljeno: number
}

export function FerrataUpcomingActionCard(props: { action: FerrataUpcomingAction }) {
  const { t } = useTranslation('ferrate')
  const { action } = props
  const d = new Date(action.startAt)
  const day = d.toLocaleDateString('sr-Latn', { day: '2-digit', month: 'short' }).toUpperCase()
  const year = d.toLocaleDateString('sr-Latn', { year: 'numeric' })
  const spots =
    action.maxLjudi > 0 ? Math.max(0, action.maxLjudi - Number(action.prijavljeno || 0)) : null

  return (
    <li className="min-w-0">
      <article className="overflow-hidden rounded-xl border border-emerald-100/90 bg-white shadow-sm ring-1 ring-black/[0.02] transition hover:border-emerald-200 hover:shadow-md">
        <div className="flex min-w-0 gap-3 p-3">
          <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 py-2 text-center">
            <span className="text-[10px] font-bold leading-tight text-emerald-800">{day}</span>
            <span className="mt-0.5 text-[9px] font-semibold text-emerald-600/80">{year}</span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-bold leading-snug text-gray-900">{action.naziv}</p>
            {action.klubNaziv && (
              <p className="mt-0.5 truncate text-xs text-gray-500">{action.klubNaziv}</p>
            )}
            {spots != null && (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-gray-500">
                <UsersIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                <span>{t('sidebarUpcomingSpots', { n: spots })}</span>
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-emerald-50/90 bg-gradient-to-b from-white to-emerald-50/25 px-3 py-2.5">
          <Link
            to={`/akcije/${action.id}`}
            className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs font-bold text-emerald-900 transition hover:border-emerald-300 hover:bg-emerald-100/90 active:scale-[0.99]"
          >
            {t('sidebarViewAction')}
          </Link>
        </div>
      </article>
    </li>
  )
}
