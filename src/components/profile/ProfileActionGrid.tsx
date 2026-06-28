import { Link } from 'react-router-dom'

import { computePERForAkcija, type AkcijaZaRanking } from '@beleg/shared/utils'

import { AkcijaImageOrFallback } from '../AkcijaImageFallback'

export type ProfileActionGridItem = {
  id: number
  naziv: string
  slikaUrl?: string
} & AkcijaZaRanking

interface ProfileActionGridProps {
  actions: ProfileActionGridItem[]
  mode?: 'climbed' | 'guided'
}

/** 3 kolone, kvadratne slike — isti raspored kao mobilni profil. */
export function ProfileActionGrid({ actions, mode = 'climbed' }: ProfileActionGridProps) {
  const fallbackClass = mode === 'guided' ? 'bg-violet-600' : 'bg-emerald-600'
  const badgeClass =
    mode === 'guided'
      ? 'bg-violet-600/95 text-white'
      : 'bg-emerald-500/95 text-white'

  return (
    <div className="grid grid-cols-3 gap-px w-full" role="list">
      {actions.map((akcija) => {
        const per = computePERForAkcija(akcija)

        return (
          <Link
            key={akcija.id}
            to={`/akcije/${akcija.id}`}
            role="listitem"
            aria-label={per > 0 ? `${akcija.naziv}, ${per} PER` : akcija.naziv}
            className={`group relative aspect-square overflow-hidden ${fallbackClass} hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500`}
          >
            <AkcijaImageOrFallback
              src={akcija.slikaUrl}
              alt=""
              imgClassName="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            {per > 0 ? (
              <span
                className={`absolute bottom-1 right-1 min-w-[1.35rem] rounded px-1 py-0.5 text-center text-[9px] font-bold leading-none tabular-nums shadow-sm ${badgeClass}`}
              >
                {per}
              </span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
