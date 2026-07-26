import { Link } from 'react-router-dom'
import { LockClosedIcon } from '@heroicons/react/24/outline'
import { PRIVATE_PASSPORT_BADGE } from '../../utils/profileIdentity'

/** Owner-only shortcut ka privatnim članskim podacima (bez prikaza brojeva). */
export function ProfilePassportShortcut({
  settingsHref,
  className = '',
}: {
  settingsHref: string
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`.trim()}
      data-testid="profile-passport-shortcut"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-emerald-950 tracking-tight">
              Planinarska legitimacija i članski podaci
            </p>
            <span
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200/80 bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800"
              data-testid="profile-passport-private-badge"
            >
              <LockClosedIcon className="h-3.5 w-3.5" aria-hidden />
              <span>{PRIVATE_PASSPORT_BADGE}</span>
            </span>
          </div>
          <p className="mt-0.5 text-xs text-emerald-900/70 leading-snug">
            Legitimacija, markica i privatni članski podaci dostupni su samo vama i ovlašćenom klubu.
          </p>
        </div>
        <Link
          to={settingsHref}
          className="inline-flex shrink-0 items-center justify-center min-h-11 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 transition-colors"
        >
          Otvori podešavanja
        </Link>
      </div>
    </div>
  )
}
