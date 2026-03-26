import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export type FollowListUser = {
  id: number
  username: string
  fullName?: string
  avatarUrl?: string
  role?: string
  klubNaziv?: string
}

export default function FollowListModal({
  open,
  title,
  users,
  loading,
  onClose,
}: {
  open: boolean
  title: string
  users: FollowListUser[]
  loading: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 backdrop-blur-sm px-3 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Praćenje</p>
            <h3 className="text-base font-extrabold text-gray-900 truncate">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 transition"
            aria-label="Zatvori"
            title="Zatvori (Esc)"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[min(65vh,520px)] overflow-auto">
          {loading ? (
            <div className="p-6 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
              <p className="mt-3 text-sm text-gray-500 font-medium">Učitavam…</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-500 font-medium">Lista je prazna.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {users.map((u) => (
                <li key={u.id} className="px-5 py-3 hover:bg-gray-50/60 transition">
                  <Link to={`/korisnik/${u.username}`} className="flex items-center gap-3" onClick={onClose}>
                    {u.avatarUrl ? (
                      <img
                        src={u.avatarUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover border border-gray-100"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-extrabold">
                        {(u.fullName || u.username || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 truncate">{u.fullName?.trim() || u.username}</p>
                      <p className="text-xs text-gray-500 truncate">
                        @{u.username}
                        {u.klubNaziv ? <span className="text-gray-300"> · </span> : null}
                        {u.klubNaziv ? <span>{u.klubNaziv}</span> : null}
                      </p>
                    </div>
                    <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

