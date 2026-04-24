interface EquipmentItemProps {
  naziv: string
  obavezna?: boolean
  rent?: {
    rentId: number
    dostupnaKolicina: number
    cenaPoSetu: number
  }
  currency: string
  selectedKolicina: number
  disabled?: boolean
  onChange: (next: number) => void
}

export default function EquipmentItem({
  naziv,
  obavezna,
  rent,
  currency,
  selectedKolicina,
  disabled,
  onChange,
}: EquipmentItemProps) {
  const maxQty = rent ? rent.dostupnaKolicina + selectedKolicina : 0
  const rentable = !!rent && (rent.dostupnaKolicina > 0 || selectedKolicina > 0)
  const unavailable = !!rent && rent.dostupnaKolicina === 0 && selectedKolicina === 0

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 transition-all ${
        selectedKolicina > 0
          ? 'border-violet-300 bg-gradient-to-r from-violet-50 to-fuchsia-50 shadow-sm'
          : 'border-gray-100 bg-white hover:border-gray-200'
      }`}
    >
      <div className="min-w-0 flex items-center gap-2.5">
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-xl shrink-0 ${
            selectedKolicina > 0
              ? 'bg-violet-100 text-violet-600'
              : obavezna
                ? 'bg-rose-50 text-rose-500'
                : 'bg-gray-100 text-gray-500'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate flex items-center gap-2">
            {naziv}
            {obavezna && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                Obavezna
              </span>
            )}
          </p>
          {rent ? (
            <p className="text-[11px] text-gray-500 font-medium">
              Dostupno: <span className="font-bold text-gray-700">{rent.dostupnaKolicina}</span>
              {' · '}
              <span className="font-bold text-gray-700">
                {rent.cenaPoSetu.toFixed(2)} {currency}
              </span>
              /set
            </p>
          ) : (
            <p className="text-[11px] text-gray-500">Članovi su dužni da donesu sopstvenu</p>
          )}
        </div>
      </div>

      {rent && (
        <div className="flex items-center gap-1.5 shrink-0">
          {unavailable ? (
            <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200">
              Članovi su dužni da donesu sopstvenu
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onChange(Math.max(0, selectedKolicina - 1))}
                disabled={disabled || !rentable || selectedKolicina === 0}
                className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Smanji količinu"
              >
                −
              </button>
              <div className="min-w-[2.5rem] text-center">
                <p className="text-sm font-extrabold text-gray-900 tabular-nums">{selectedKolicina}</p>
              </div>
              <button
                type="button"
                onClick={() => onChange(Math.min(maxQty, selectedKolicina + 1))}
                disabled={disabled || !rentable || selectedKolicina >= maxQty}
                className="w-8 h-8 rounded-lg bg-violet-500 text-white text-sm font-bold hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Povećaj količinu"
              >
                +
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
