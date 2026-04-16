interface AccommodationCardProps {
  id: number
  naziv: string
  opis?: string
  cenaPoOsobiUkupno: number
  currency: string
  selected: boolean
  disabled?: boolean
  onToggle: () => void
}

export default function AccommodationCard({
  naziv,
  opis,
  cenaPoOsobiUkupno,
  currency,
  selected,
  disabled,
  onToggle,
}: AccommodationCardProps) {
  return (
    <div
      className={`relative rounded-2xl border p-4 transition-all ${
        selected
          ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 shadow-md shadow-amber-100'
          : 'border-gray-100 bg-white hover:border-amber-200 hover:bg-amber-50/30'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-50 border border-amber-100">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </span>
            <p className="text-base font-extrabold text-gray-900 truncate">{naziv}</p>
          </div>
          {opis && <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{opis}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Po osobi</p>
          <p className="text-lg font-extrabold text-gray-900">
            {cenaPoOsobiUkupno.toFixed(2)} <span className="text-gray-500 text-xs font-bold">{currency}</span>
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${
          selected
            ? 'bg-amber-500 text-white hover:bg-amber-400 shadow-sm'
            : 'bg-gray-100 text-gray-700 hover:bg-amber-100 hover:text-amber-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {selected ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Rezervisan
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Potreban mi je ovaj smeštaj
          </>
        )}
      </button>
    </div>
  )
}
