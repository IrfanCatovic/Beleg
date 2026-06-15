/**
 * Sky/indigo marker sa ikonom planinskog vrha — vizuelno razlicit od zelenog ferata i amber hotel markera.
 */
export function PeakMarkerElement({ active = false }: { active?: boolean }) {
  return (
    <div
      className={`planiner-marker-peak relative flex h-11 w-11 -translate-y-1 items-center justify-center select-none${active ? ' planiner-marker--active' : ''}`}
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-300 via-indigo-500 to-indigo-700 shadow-lg ring-[3px] ring-white/95" />
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
        <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
      </svg>
    </div>
  )
}
