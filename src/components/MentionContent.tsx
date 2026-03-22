import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Isto kao backend mentionRegex — notifikacije za @username (3–30 znakova). */
const MENTION_RE = /@([A-Za-z0-9_\.]{3,30})/g

/**
 * Prikaz teksta sa klikabilnim @username linkovima na profil (/korisnik/:username).
 * Novi redovi i razmaci ostaju (roditelj treba whitespace-pre-wrap po potrebi).
 */
export default function MentionContent({
  text,
  className = '',
  linkClassName = 'font-semibold text-emerald-700 hover:text-emerald-800 hover:underline',
}: {
  text: string
  className?: string
  linkClassName?: string
}) {
  const nodes: ReactNode[] = []
  let last = 0
  let k = 0

  for (const m of text.matchAll(MENTION_RE)) {
    const i = m.index ?? 0
    if (i > last) {
      nodes.push(<span key={k++}>{text.slice(last, i)}</span>)
    }
    const username = m[1]
    nodes.push(
      <Link
        key={k++}
        to={`/korisnik/${encodeURIComponent(username)}`}
        className={linkClassName}
        onClick={(e) => e.stopPropagation()}
      >
        @{username}
      </Link>
    )
    last = i + m[0].length
  }

  if (last < text.length) {
    nodes.push(<span key={k++}>{text.slice(last)}</span>)
  }

  if (nodes.length === 0) {
    return <span className={className}>{text}</span>
  }

  return <span className={className}>{nodes}</span>
}
