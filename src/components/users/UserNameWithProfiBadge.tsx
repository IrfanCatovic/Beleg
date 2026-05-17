import type { ReactNode } from 'react'
import { ProfiGuideBadge } from '../guides/ProfiGuideBadge'

/** Ime korisnika sa opcionim Profi vodič bedžom pored. */
export function UserNameWithProfiBadge(props: {
  name: ReactNode
  isProfiGuide?: boolean
  badgeSize?: number
  className?: string
  nameClassName?: string
}) {
  const { name, isProfiGuide, badgeSize = 20, className = '', nameClassName = '' } = props

  return (
    <span className={`inline-flex min-w-0 max-w-full items-center gap-1.5 ${className}`}>
      <span className={`min-w-0 truncate ${nameClassName}`}>{name}</span>
      {isProfiGuide && <ProfiGuideBadge size={badgeSize} className="shrink-0" />}
    </span>
  )
}
