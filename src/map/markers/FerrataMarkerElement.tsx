import type { PlaninerMapMarkerKind } from './markerKinds'

type Props = {
  /** Za buduće: isti DOM omotač, druga ikonica po vrsti. */
  kind?: Extract<PlaninerMapMarkerKind, 'ferrata'>
  active?: boolean
}

/**
 * Zeleni marker: planinski reljef + karabiner (prepoznatljivo za ferate).
 */
export function FerrataMarkerElement(props: Props) {
  void props.kind
  return (
    <div
      className={`planiner-marker-ferrata relative flex h-12 w-12 -translate-y-1 items-center justify-center select-none${props.active ? ' planiner-marker--active' : ''}`}
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-600 to-emerald-900 shadow-lg ring-[3px] ring-white/95" />
      <svg
        className="relative z-10 h-7 w-7 text-white drop-shadow-sm"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M5 18 L9 10 L12 14 L15 8 L19 18 Z"
          fill="currentColor"
          fillOpacity="0.25"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M11 5.5 C11 4.12 12.12 3 13.5 3 H14.2 C15.2 3 16 3.8 16 4.8 V9.5 C16 10.33 15.33 11 14.5 11 H13.5 C12.67 11 12 10.33 12 9.5 V7"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 7 V11.5 C12 12.88 10.88 14 9.5 14 H8.8 C7.8 14 7 13.2 7 12.2 V7.5 C7 6.67 7.67 6 8.5 6 H9.5 C10.33 6 11 6.67 11 7.5"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
