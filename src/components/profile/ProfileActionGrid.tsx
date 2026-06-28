import { Link } from 'react-router-dom'

import { AkcijaImageOrFallback } from '../AkcijaImageFallback'

export interface ProfileActionGridItem {
  id: number
  naziv: string
  slikaUrl?: string
}

interface ProfileActionGridProps {
  actions: ProfileActionGridItem[]
  mode?: 'climbed' | 'guided'
}

/** 3 kolone, kvadratne slike — isti raspored kao mobilni profil. */
export function ProfileActionGrid({ actions, mode = 'climbed' }: ProfileActionGridProps) {
  const fallbackClass = mode === 'guided' ? 'bg-violet-600' : 'bg-emerald-600'

  return (
    <div className="grid grid-cols-3 gap-px w-full" role="list">
      {actions.map((akcija) => (
        <Link
          key={akcija.id}
          to={`/akcije/${akcija.id}`}
          role="listitem"
          aria-label={akcija.naziv}
          className={`group relative aspect-square overflow-hidden ${fallbackClass} hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500`}
        >
          <AkcijaImageOrFallback
            src={akcija.slikaUrl}
            alt=""
            imgClassName="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>
      ))}
    </div>
  )
}
