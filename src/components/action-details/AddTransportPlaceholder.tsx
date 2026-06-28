interface AddTransportPlaceholderProps {
  onClick?: () => void
  disabled?: boolean
}

export default function AddTransportPlaceholder({ onClick, disabled }: AddTransportPlaceholderProps) {
  const inner = (
    <>
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </span>
      <p className="mt-3 text-sm font-semibold text-gray-700">Dodaj prevoz</p>
      <p className="mt-1 text-xs text-gray-500">
        {disabled
          ? 'Prijavite se na akciju da biste mogli da dodate prevoz.'
          : 'Nema opcija prevoza — kliknite da dodate svoju.'}
      </p>
    </>
  )

  if (disabled || !onClick) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/80 p-8 text-center">
        {inner}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/40 p-8 text-center transition-all hover:border-sky-300 hover:bg-sky-50/80 hover:shadow-sm active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      {inner}
    </button>
  )
}
