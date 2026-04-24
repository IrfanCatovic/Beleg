import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDebounce } from '../hooks/useDebounce'
import { useGlobalSearch, type SearchKorisnik, type SearchAkcija, type SearchTransakcija } from '../hooks/useGlobalSearch'
import { formatDateShort } from '../utils/dateUtils'
import { useTranslation } from 'react-i18next'

type SearchTab = 'clanovi' | 'akcije' | 'finansije'

function SearchUserAvatar({
  fullName,
  username,
  avatarUrl,
}: {
  fullName?: string
  username: string
  avatarUrl?: string
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const url = (avatarUrl || '').trim()
  if (url && !imgFailed) {
    return (
      <img
        src={url}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover bg-gray-100 ring-1 ring-gray-200/80"
        onError={() => setImgFailed(true)}
      />
    )
  }
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#41ac53]/10 text-[#41ac53] font-semibold text-sm"
      aria-hidden
    >
      {(fullName || username || '?').charAt(0).toUpperCase()}
    </span>
  )
}

interface GlobalSearchPanelProps {
  searchQuery: string
  setSearchQuery: (v: string) => void
  onClose: () => void
  canSeeFinances: boolean
  /** Ako je true, prikazuje se kao overlay (header dropdown); ako false, kao full-page na /search */
  embedded?: boolean
  /** Prikaži dugme "Detaljnija pretraga" (na stranici /search se ne prikazuje) */
  showDetailButton?: boolean
}

function ResultListClanovi({
  items,
  onPick,
}: {
  items: SearchKorisnik[]
  onPick: () => void
}) {
  const navigate = useNavigate()
  const { t } = useTranslation('shared')
  if (items.length === 0) return null
  return (
    <ul className="space-y-0.5">
      {items.map((k) => (
        <li key={k.id}>
          <button
            type="button"
            onClick={() => {
              navigate(`/korisnik/${k.username}`)
              onPick()
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors"
          >
            <SearchUserAvatar fullName={k.fullName} username={k.username} avatarUrl={k.avatar_url} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 truncate">{k.fullName || k.username}</p>
              <p className="text-xs text-gray-500 truncate flex items-center gap-1.5">
                <span>@{k.username}</span>
                <span className="w-0.5 h-0.5 rounded-full bg-gray-300 flex-shrink-0" />
                {k.klubNaziv ? (
                  <span className="inline-flex items-center gap-1 text-violet-600 font-medium truncate">
                    {k.klubLogoUrl ? (
                      <img src={k.klubLogoUrl} alt="" className="w-3 h-3 rounded-sm object-cover flex-shrink-0" />
                    ) : (
                      <svg className="w-3 h-3 text-violet-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                      </svg>
                    )}
                    {k.klubNaziv}
                  </span>
                ) : (
                  <span className="text-gray-500 truncate">{t('globalSearch.noClubUser')}</span>
                )}
              </p>
            </div>
            <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  )
}

function ResultListAkcije({
  items,
  onPick,
}: {
  items: SearchAkcija[]
  onPick: () => void
}) {
  const navigate = useNavigate()
  if (items.length === 0) return null
  return (
    <ul className="space-y-0.5">
      {items.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => {
              navigate(`/akcije/${a.id}`)
              onPick()
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v8m-4-4h8m5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 truncate">{a.naziv}</p>
              <p className="text-xs text-gray-500 truncate">
                {[a.planina, a.vrh, a.datum && formatDateShort(a.datum)].filter(Boolean).join(' · ')}
              </p>
            </div>
            <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  )
}

function ResultListFinansije({
  items,
  onPick,
}: {
  items: SearchTransakcija[]
  onPick: () => void
}) {
  const navigate = useNavigate()
  if (items.length === 0) return null
  return (
    <ul className="space-y-0.5">
      {items.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => {
              navigate('/finansije')
              onPick()
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .843-3 2s1.343 2 3 2 3 .843 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.6 1M12 8V6m0 10v2m8-10a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 truncate">{t.opis || t.tip}</p>
              <p className="text-xs text-gray-500 truncate">
                {t.korisnik?.fullName || t.korisnik?.username} · {formatDateShort(t.datum)}
              </p>
            </div>
            <span className={`shrink-0 text-sm font-medium ${t.tip === 'uplata' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {t.tip === 'uplata' ? '+' : '−'}{Math.abs(t.iznos).toLocaleString('sr-RS')} RSD
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export default function GlobalSearchPanel({
  searchQuery,
  setSearchQuery,
  onClose,
  canSeeFinances,
  embedded = true,
  showDetailButton = true,
}: GlobalSearchPanelProps) {
  const { t } = useTranslation('shared')
  const navigate = useNavigate()
  const debouncedQuery = useDebounce(searchQuery, 320)
  const [activeTab, setActiveTab] = useState<SearchTab>('clanovi')

  const { loading, results, error } = useGlobalSearch(debouncedQuery, {
    canSeeFinances,
    enabled: true,
  })

  const hasQuery = searchQuery.trim().length >= 2

  const tabs: { id: SearchTab; label: string; count: number }[] = [
    { id: 'clanovi', label: t('globalSearch.tabs.members'), count: results.clanovi.length },
    { id: 'akcije', label: t('globalSearch.tabs.actions'), count: results.akcije.length },
    ...(canSeeFinances ? [{ id: 'finansije' as const, label: t('globalSearch.tabs.finances'), count: results.finansije.length }] : []),
  ]

  const goToDetailSearch = () => {
    onClose()
    const q = searchQuery.trim()
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  }

  return (
    <div className={embedded ? 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3' : 'p-4 sm:p-6'}>
      <div className={`mx-auto w-full ${embedded ? 'max-w-3xl' : 'max-w-2xl'} flex flex-col gap-3`}>
        {/* Search input row */}
        <div className="flex items-center gap-3">
          <span className="text-gray-400 shrink-0" aria-hidden>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.5 4.5a6 6 0 014.615 9.847l3.769 3.768-1.414 1.415-3.768-3.769A6 6 0 1110.5 4.5z" />
            </svg>
          </span>
          <input
            autoFocus={embedded}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('globalSearch.placeholder')}
            className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#41ac53] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#41ac53]/20 transition-all"
            aria-label={t('globalSearch.ariaSearch')}
          />
          {embedded && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap"
            >
              {t('globalSearch.close')}
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 py-4 text-gray-500" role="status" aria-live="polite">
            <svg className="h-5 w-5 animate-spin text-[#41ac53]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm">{t('globalSearch.loadingResults')}</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <p className="text-sm text-rose-600 py-2">{error}</p>
        )}

        {/* Tabs + results */}
        {!loading && hasQuery && (
          <>
            <div className="flex gap-1 p-0.5 rounded-xl bg-gray-100" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-1.5 text-xs text-gray-400">({tab.count})</span>
                  )}
                </button>
              ))}
            </div>

            <div className="max-h-[min(72vh,320px)] overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/50" role="tabpanel">
              {activeTab === 'clanovi' && (
                <div className="p-2">
                  {results.clanovi.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-500">{t('globalSearch.emptyMembers')}</p>
                  ) : (
                    <ResultListClanovi items={results.clanovi} onPick={onClose} />
                  )}
                </div>
              )}
              {activeTab === 'akcije' && (
                <div className="p-2">
                  {results.akcije.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-500">{t('globalSearch.emptyActions')}</p>
                  ) : (
                    <ResultListAkcije items={results.akcije} onPick={onClose} />
                  )}
                </div>
              )}
              {activeTab === 'finansije' && (
                <div className="p-2">
                  {results.finansije.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-500">{t('globalSearch.emptyTransactions')}</p>
                  ) : (
                    <ResultListFinansije items={results.finansije} onPick={onClose} />
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Quick links when no search query */}
        {!loading && !hasQuery && (
          <div className="max-h-72 overflow-y-auto">
            <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {t('globalSearch.quickLinks')}
            </p>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => { onClose(); navigate('/users'); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#41ac53]/10 text-[#41ac53]">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5V4H2v16h5m10 0V10m0 10h-4m4 0h4M7 20v-6m0 6H3m4 0h4" />
                  </svg>
                </span>
                <span>
                  <span className="block text-xs font-medium text-gray-900">{t('globalSearch.links.members')}</span>
                  <span className="block text-[11px] text-gray-500">{t('globalSearch.links.membersSub')}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => { onClose(); navigate('/akcije'); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v8m-4-4h8m5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <span>
                  <span className="block text-xs font-medium text-gray-900">{t('globalSearch.links.actions')}</span>
                  <span className="block text-[11px] text-gray-500">{t('globalSearch.links.actionsSub')}</span>
                </span>
              </button>
              {canSeeFinances && (
                <button
                  type="button"
                  onClick={() => { onClose(); navigate('/finansije'); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .843-3 2s1.343 2 3 2 3 .843 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.6 1M12 8V6m0 10v2m8-10a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-xs font-medium text-gray-900">{t('globalSearch.links.finances')}</span>
                    <span className="block text-[11px] text-gray-500">{t('globalSearch.links.financesSub')}</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Detaljnija pretraga button */}
        {showDetailButton && (
          <div className="pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={goToDetailSearch}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-[#41ac53]/40 hover:text-[#41ac53] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {t('globalSearch.detailedSearch')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
