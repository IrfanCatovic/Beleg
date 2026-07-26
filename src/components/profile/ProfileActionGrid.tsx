import { Link } from 'react-router-dom'

import { computePERForAkcija, type AkcijaZaRanking } from '@beleg/shared/utils'

import { AkcijaImageOrFallback } from '../AkcijaImageFallback'
import { actionCardAccessibilityLabel } from '../../utils/profileEmptyStates'

export type ProfileActionGridItem = {
  id: number
  naziv: string
  slikaUrl?: string
} & AkcijaZaRanking

interface ProfileActionGridProps {
  actions: ProfileActionGridItem[]
  mode?: 'climbed' | 'guided'
  /** Optional section label for assistive tech. */
  ariaLabel?: string
}

/** 3 kolone, kvadratne slike — isti raspored kao mobilni profil. */
export function ProfileActionGrid({
  actions,
  mode = 'climbed',
  ariaLabel = 'Planinarska istorija',
}: ProfileActionGridProps) {
  const fallbackClass = mode === 'guided' ? 'bg-violet-600' : 'bg-emerald-600'
  const badgeClass =
    mode === 'guided'
      ? 'bg-violet-600/95 text-white'
      : 'bg-emerald-500/95 text-white'
  const focusRing =
    mode === 'guided'
      ? 'focus-visible:ring-violet-500'
      : 'focus-visible:ring-emerald-500'

  return (
    <ul
      className="grid grid-cols-3 gap-px w-full list-none m-0 p-0"
      aria-label={ariaLabel}
    >
      {actions.map((akcija) => {
        const per = computePERForAkcija(akcija)
        const label = actionCardAccessibilityLabel(akcija.naziv, per)

        return (
          <li key={akcija.id} className="min-w-0">
            <Link
              to={`/akcije/${akcija.id}`}
              aria-label={label}
              className={`group relative block aspect-square overflow-hidden ${fallbackClass} hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-inset ${focusRing}`}
            >
              <AkcijaImageOrFallback
                src={akcija.slikaUrl}
                alt={akcija.naziv || 'Akcija'}
                imgClassName="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] pointer-events-none"
              />
              {per > 0 ? (
                <span
                  className={`absolute bottom-1 right-1 min-w-[1.35rem] rounded px-1 py-0.5 text-center text-[9px] font-bold leading-none tabular-nums shadow-sm ${badgeClass}`}
                  aria-hidden
                >
                  {per}
                </span>
              ) : null}
              <span className="sr-only">{label}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** Umjeren broj skeleton kartica dok se istorija učitava. */
export function ProfileActionGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-3 gap-px w-full"
      role="status"
      aria-busy="true"
      aria-label="Učitavanje planinarske istorije"
      data-testid="profile-actions-skeleton"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="aspect-square animate-pulse bg-gray-200/80"
        />
      ))}
    </div>
  )
}
