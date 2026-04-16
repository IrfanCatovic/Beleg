interface AvatarSlotsProps {
  capacity: number
  participants: Array<{ korisnik: string; fullName?: string; avatarUrl?: string }>
  emptyLabel?: string
  highlightUsername?: string
}

const MAX_VISIBLE = 4

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?'
}

function pickVisible<T>(arr: T[], n: number, seed: number): T[] {
  if (arr.length <= n) return arr
  let h = seed >>> 0
  const pool = [...arr]
  const out: T[] = []
  for (let i = 0; i < n; i++) {
    h = (h * 1664525 + 1013904223) >>> 0
    const idx = h % pool.length
    out.push(pool.splice(idx, 1)[0])
  }
  return out
}

export default function AvatarSlots({ capacity, participants, emptyLabel, highlightUsername }: AvatarSlotsProps) {
  const visibleCount = Math.min(MAX_VISIBLE, Math.max(capacity, 1))
  const highlightIndex = highlightUsername
    ? participants.findIndex((p) => p.korisnik === highlightUsername)
    : -1
  const pickSeed = participants.length + capacity * 17
  let chosen = pickVisible(participants, visibleCount, pickSeed)
  if (highlightIndex >= 0 && !chosen.find((c) => c.korisnik === highlightUsername)) {
    chosen = [participants[highlightIndex], ...chosen.slice(0, visibleCount - 1)]
  }

  const emptyCount = Math.max(0, visibleCount - chosen.length)

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {chosen.map((p) => {
          const name = p.fullName?.trim() || p.korisnik
          const isMe = highlightUsername && p.korisnik === highlightUsername
          return (
            <div
              key={p.korisnik}
              title={name}
              className={`relative w-9 h-9 rounded-full overflow-hidden ring-2 ${isMe ? 'ring-emerald-500' : 'ring-white'} bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shadow-sm`}
            >
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <span>{initial(name)}</span>
              )}
            </div>
          )
        })}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-9 h-9 rounded-full ring-2 ring-white bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-gray-300"
            title={emptyLabel || 'Slobodno mesto'}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
        ))}
      </div>
      {participants.length > visibleCount && (
        <span className="text-[11px] font-semibold text-gray-500">+{participants.length - visibleCount}</span>
      )}
    </div>
  )
}
