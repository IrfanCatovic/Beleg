export function SummaryCell({ icon, iconBg, value, label, accent }: {
  icon: React.ReactNode
  iconBg: string
  value: string
  label: string
  accent: string
}) {
  return (
    <div className="flex items-center justify-between sm:justify-center gap-3 py-4 px-4 sm:px-3">
      <div className={`flex-shrink-0 h-8 w-8 rounded-xl ${iconBg} flex items-center justify-center`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1 sm:flex-initial">
        <p className={`text-base sm:text-lg font-extrabold leading-none tracking-tight ${accent} break-words`}>
          {value}
        </p>
        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export function Pagination({ currentPage, totalPages, onPageChange, prevLabel, nextLabel, prevAria, nextAria, pageAria, pageOf }: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  prevLabel: string
  nextLabel: string
  prevAria: string
  nextAria: string
  pageAria: string
  pageOf: string
}) {
  const prevDisabled = currentPage === 1
  const nextDisabled = currentPage === totalPages

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | 'ellipsis')[] = [1]
    const left = Math.max(2, currentPage - 1)
    const right = Math.min(totalPages - 1, currentPage + 1)
    if (left > 2) pages.push('ellipsis')
    for (let p = left; p <= right; p++) if (p !== 1 && p !== totalPages) pages.push(p)
    if (right < totalPages - 1) pages.push('ellipsis')
    if (totalPages > 1) pages.push(totalPages)
    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div className="border-t border-gray-100 bg-gray-50/50 px-3 sm:px-4 py-3 sm:py-3.5">
      <div className="flex items-center justify-center gap-1 sm:gap-2 min-w-0 max-w-full">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={prevDisabled}
          aria-label={prevAria}
          className="shrink-0 inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">{prevLabel}</span>
        </button>
        <div className="flex items-center justify-center gap-0.5 sm:gap-1 min-w-0 flex-1 max-w-full overflow-hidden">
          {pageNumbers.map((page, idx) =>
            page === 'ellipsis' ? (
              <span key={`e-${idx}`} className="px-1 sm:px-1.5 text-gray-400 select-none text-sm" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                aria-label={`${pageAria} ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
                className={`shrink-0 min-w-[2rem] w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-sm font-medium transition-all ${
                  page === currentPage
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-500/30'
                    : 'bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100'
                }`}
              >
                {page}
              </button>
            )
          )}
        </div>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={nextDisabled}
          aria-label={nextAria}
          className="shrink-0 inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100"
        >
          <span className="hidden sm:inline">{nextLabel}</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <p className="text-center text-[11px] text-gray-400 font-medium mt-2 sm:mt-2.5">{pageOf}</p>
    </div>
  )
}

export function EmptyState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-10 sm:p-14 text-center max-w-xl mx-auto">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 mb-3">
        {icon}
      </div>
      <p className="text-sm text-gray-500 font-medium">{text}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}
