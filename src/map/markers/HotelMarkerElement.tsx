/**
 * Topli amber marker sa ikonom kreveta — vizuelno jasno razlicit od zelenog ferata markera.
 */
export function HotelMarkerElement({ active = false }: { active?: boolean }) {
  return (
    <div
      className={`planiner-marker-hotel relative flex h-11 w-11 -translate-y-1 items-center justify-center select-none${active ? ' planiner-marker--active' : ''}`}
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-orange-600 shadow-lg ring-[3px] ring-white/95" />
      <svg
        className="relative z-10 h-6 w-6 text-white drop-shadow-sm"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M2 4v16" />
        <path d="M2 8h18a2 2 0 0 1 2 2v10" />
        <path d="M2 17h20" />
        <path d="M6 8v9" />
      </svg>
    </div>
  )
}
