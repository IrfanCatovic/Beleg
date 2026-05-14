import type { LucideIcon } from 'lucide-react'
import {
  Backpack,
  BarChart3,
  Bed,
  Calendar,
  CircleParking,
  Clock,
  MapPin,
  Mountain,
  Phone,
  Route,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  Utensils,
  Wallet,
  Zap,
} from 'lucide-react'

/** Centralizovane ikonice za Planiner (ferrate i slične sekcije). */
export type PlaninerIconName =
  | 'about'
  | 'why'
  | 'forWho'
  | 'gear'
  | 'map'
  | 'stay'
  | 'actions'
  | 'guide'
  | 'time'
  | 'distance'
  | 'height'
  | 'price'
  | 'phone'
  | 'location'
  | 'food'
  | 'parking'
  | 'instagram'
  /** Težina / kategorija (stat kartice). */
  | 'difficulty'
  /** Teža opcija (stat kartice). */
  | 'harder'

export type PlaninerIconVariant = 'solid' | 'soft' | 'small'

type PlaninerIconLucideName = Exclude<PlaninerIconName, 'instagram'>

const ICONS: Record<PlaninerIconLucideName, LucideIcon> = {
  about: Mountain,
  why: Star,
  forWho: Users,
  gear: Backpack,
  map: MapPin,
  stay: Bed,
  actions: Calendar,
  guide: UserCheck,
  time: Clock,
  distance: Route,
  height: TrendingUp,
  price: Wallet,
  phone: Phone,
  location: MapPin,
  food: Utensils,
  parking: CircleParking,
  difficulty: BarChart3,
  harder: Zap,
}

function InstagramGlyph(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

function cx(...parts: (string | undefined | false)[]) {
  return parts.filter(Boolean).join(' ')
}

export type PlaninerIconProps = {
  name: PlaninerIconName
  variant?: PlaninerIconVariant
  className?: string
  /** Podrazumevano uklonjeno iz čitača kad je dekorativno. */
  'aria-hidden'?: boolean
}

export function PlaninerIcon(props: PlaninerIconProps) {
  const { name, variant = 'solid', className, 'aria-hidden': ariaHidden = true } = props

  const wrapper =
    variant === 'solid'
      ? cx(
          'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-900 text-white shadow-md ring-4 ring-emerald-50',
          'h-11 w-11',
        )
      : variant === 'soft'
        ? cx(
            'inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
            'h-11 w-11',
          )
        : cx(
            'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-900 text-white shadow-md ring-2 ring-emerald-50',
            'h-8 w-8',
          )

  const iconClass = variant === 'small' ? 'h-4 w-4' : 'h-5 w-5'
  const stroke = variant === 'small' ? 2.25 : 2

  if (name === 'instagram') {
    return (
      <span className={cx(wrapper, className)} aria-hidden={ariaHidden}>
        <InstagramGlyph className={iconClass} />
      </span>
    )
  }

  const Icon = ICONS[name]

  return (
    <span className={cx(wrapper, className)} aria-hidden={ariaHidden}>
      <Icon className={iconClass} strokeWidth={stroke} />
    </span>
  )
}
