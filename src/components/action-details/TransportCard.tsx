import AvatarSlots from './AvatarSlots'

export interface PrevozParticipant {
  prijavaId: number
  korisnik: string
  fullName?: string
  avatarUrl?: string
}

interface TransportCardProps {
  id: number
  tipPrevoza: string
  nazivGrupe: string
  kapacitet: number
  cenaPoOsobi: number
  currency: string
  participants: PrevozParticipant[]
  myUsername?: string
  selected: boolean
  disabled?: boolean
  onToggle: () => void
  /** Host/admin: small trash to remove this transport option */
  canDelete?: boolean
  onRequestDelete?: () => void
}

function typeIcon(tip: string) {
  const t = tip.toLowerCase()
  if (t.includes('bus') || t.includes('avto')) {
    return (
      <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM19 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM4.5 17h15m-15 0V7a2 2 0 012-2h11a2 2 0 012 2v10M4.5 12h15" />
      </svg>
    )
  }
  if (t.includes('voz') || t.includes('train')) {
    return (
      <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 11h14M5 7a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-1l1.5 3h-2L14 17H10l-1.5 3h-2L8 17H7a2 2 0 01-2-2V7z" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 17a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM19 17a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM3 12l1.5-5a2 2 0 012-1.5h11a2 2 0 012 1.5L21 12m-18 0v5h2m16-5v5h-2m-14-5h14" />
    </svg>
  )
}

export default function TransportCard({
  id,
  tipPrevoza,
  nazivGrupe,
  kapacitet,
  cenaPoOsobi,
  currency,
  participants,
  myUsername,
  selected,
  disabled,
  onToggle,
  canDelete,
  onRequestDelete,
}: TransportCardProps) {
  const occupied = participants.length
  const isFull = kapacitet > 0 && occupied >= kapacitet && !selected
  const pct = kapacitet > 0 ? Math.min(100, Math.round((occupied / kapacitet) * 100)) : 0

  return (
    <div className="relative w-full" data-prevoz-id={id}>
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || isFull}
      className={`relative z-0 w-full text-left rounded-2xl border p-4 pr-12 pb-12 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        selected
          ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-md shadow-emerald-100'
          : isFull
            ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
            : 'border-gray-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/30 hover:shadow-sm active:scale-[0.99]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-sky-50">
              {typeIcon(tipPrevoza)}
            </span>
            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600">{tipPrevoza}</p>
          </div>
          <p className="mt-1 text-base font-extrabold text-gray-900 truncate">{nazivGrupe}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Po osobi</p>
          <p className="text-sm font-extrabold text-gray-900">
            {cenaPoOsobi.toFixed(2)} <span className="text-gray-500 text-xs font-bold">{currency}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <AvatarSlots
          capacity={kapacitet}
          participants={participants}
          highlightUsername={myUsername}
          emptyLabel="Slobodno mesto"
        />
        <div className="text-right">
          <p className="text-[11px] font-semibold text-gray-500">
            <span className="text-gray-900 font-bold">{occupied}</span>
            <span className="text-gray-400">/{kapacitet}</span>
          </p>
          {isFull && !selected && <p className="text-[10px] font-bold text-rose-500">Popunjeno</p>}
        </div>
      </div>

      {kapacitet > 0 && (
        <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full ${isFull ? 'bg-rose-400' : selected ? 'bg-emerald-500' : 'bg-sky-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {selected && (
        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Prijavljen/a si za ovaj prevoz
        </div>
      )}
    </button>

    {canDelete && onRequestDelete && (
      <button
        type="button"
        aria-label="Obriši prevoz"
        title="Obriši prevoz"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onRequestDelete()
        }}
        className="absolute bottom-2.5 right-2.5 z-10 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397M5.79 5.79a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>
    )}
    </div>
  )
}
