import { useEffect, useRef, useState } from 'react'
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import GlobalSearchPanel from '../components/GlobalSearchPanel'
import api from '../services/api'
import { formatRelativeTime } from '../utils/dateUtils'

interface ObavestenjeItem {
  id: number
  userId: number
  type: string
  title: string
  body?: string
  link?: string
  readAt?: string | null
  createdAt: string
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
    isActive
      ? 'bg-white/20 text-white'
      : 'text-white/90 hover:bg-white/15 hover:text-white'
  }`

export default function AppLayout() {
  const { logout, user, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notifications, setNotifications] = useState<ObavestenjeItem[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const searchPanelRef = useRef<HTMLDivElement>(null)
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const notificationsBlockRef = useRef<HTMLDivElement>(null)
  const mobileNotificationsPanelRef = useRef<HTMLDivElement>(null)
  const mobileNotificationsButtonRef = useRef<HTMLButtonElement>(null)
  const profileBlockRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCmdK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
      if (isCmdK) {
        event.preventDefault()
        setIsNotificationsOpen(false)
        setIsSearchOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const insideSearch = searchPanelRef.current?.contains(target) || searchButtonRef.current?.contains(target)
      if (isSearchOpen && !insideSearch) setIsSearchOpen(false)
      const insideNotifications =
        notificationsBlockRef.current?.contains(target) ||
        mobileNotificationsPanelRef.current?.contains(target) ||
        mobileNotificationsButtonRef.current?.contains(target)
      if (isNotificationsOpen && !insideNotifications) setIsNotificationsOpen(false)
      if (isProfileMenuOpen && profileBlockRef.current && !profileBlockRef.current.contains(target)) {
        setIsProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isSearchOpen, isNotificationsOpen, isProfileMenuOpen])

  // Broj nepročitanih obaveštenja (badge)
  useEffect(() => {
    if (!isLoggedIn) return
    api.get('/api/obavestenja/unread-count').then((r) => setUnreadCount(r.data.unreadCount ?? 0)).catch(() => {})
  }, [isLoggedIn])

  // Kada se otvori dropdown: označi sva kao pročitana (meni se spusti = vidjena), pa učitaj listu
  useEffect(() => {
    if (!isLoggedIn || !isNotificationsOpen) return
    setNotificationsLoading(true)
    setUnreadCount(0)
    api
      .patch('/api/obavestenja/read-all')
      .then(() => api.get('/api/obavestenja', { params: { limit: 20 } }))
      .then((r) => setNotifications(r.data.obavestenja ?? []))
      .catch(() => setNotifications([]))
      .finally(() => setNotificationsLoading(false))
  }, [isLoggedIn, isNotificationsOpen])

  const handleNotificationClick = (n: ObavestenjeItem) => {
    if (!n.readAt) {
      api.patch(`/api/obavestenja/${n.id}/read`).then(() => setUnreadCount((c) => Math.max(0, c - 1))).catch(() => {})
    }
    if (n.link) navigate(n.link)
    setIsNotificationsOpen(false)
  }

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
    setIsMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {isLoggedIn && (
        <header className="sticky top-0 z-40 bg-[#41ac53] text-white shadow-lg shadow-[#41ac53]/20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_1fr] h-14 sm:h-16 items-center gap-4">
              <div className="flex items-center min-w-0">
                <Link
                  to="/home"
                  className="shrink-0 text-lg font-bold tracking-tight sm:text-xl md:text-2xl text-white hover:text-white/95 transition-colors"
                >
                  Adri Sentinel
                </Link>
              </div>

              <nav className="hidden md:flex items-center justify-center md:gap-1">
                <NavLink to="/akcije" className={navLinkClass}>
                  Akcije
                </NavLink>
                <NavLink to="/zadaci" className={navLinkClass}>
                  Zadaci
                </NavLink>
                <NavLink to="/users" className={navLinkClass}>
                  Članovi
                </NavLink>
                {(user?.role === 'admin' || user?.role === 'blagajnik') && (
                  <NavLink to="/finansije" className={navLinkClass}>
                    Finansije
                  </NavLink>
                )}
              </nav>

              <div className="flex items-center justify-end gap-3 relative">
                <div className="hidden md:flex md:items-center md:gap-3">
                <button
                  ref={searchButtonRef}
                  type="button"
                  onClick={() => {
                    setIsNotificationsOpen(false)
                    setIsProfileMenuOpen(false)
                    setIsSearchOpen((v) => !v)
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
                  aria-label="Pretraga"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M10.5 4.5a6 6 0 014.615 9.847l3.769 3.768-1.414 1.415-3.768-3.769A6 6 0 1110.5 4.5z"
                    />
                  </svg>
                </button>

                <div ref={notificationsBlockRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(false)
                    setIsProfileMenuOpen(false)
                    setIsNotificationsOpen((v) => !v)
                  }}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
                  aria-label="Obaveštenja"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m1 0v1a2 2 0 104 0v-1m-4 0h4"
                    />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white shadow-sm">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div className="absolute right-0 top-11 w-80 rounded-2xl bg-white py-2 shadow-xl ring-1 ring-black/5 z-40">
                    <div className="flex items-center justify-between px-3 pb-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-800">Obaveštenja</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notificationsLoading ? (
                        <p className="px-3 py-4 text-xs text-gray-500">Učitavanje...</p>
                      ) : notifications.length === 0 ? (
                        <p className="px-3 py-4 text-xs text-gray-500">Nema obaveštenja.</p>
                      ) : (
                        notifications.map((n) => {
                          const iconClass =
                            n.type === 'uplata'
                              ? 'bg-green-100 text-green-600'
                              : n.type === 'akcija'
                                ? 'bg-blue-100 text-blue-600'
                                : n.type === 'zadatak'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : n.type === 'broadcast'
                                    ? 'bg-violet-100 text-violet-600'
                                    : 'bg-gray-100 text-gray-600'
                          return (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => handleNotificationClick(n)}
                              className={`flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50 ${!n.readAt ? 'bg-green-50/50' : ''}`}
                            >
                              <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m1 0v1a2 2 0 104 0v-1m-4 0h4" />
                                </svg>
                              </span>
                              <span className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900 truncate">{n.title}</p>
                                {n.body && <p className="mt-0.5 text-[11px] text-gray-500 line-clamp-2">{n.body}</p>}
                                <p className="mt-0.5 text-[11px] text-gray-400">{formatRelativeTime(n.createdAt)}</p>
                              </span>
                            </button>
                          )
                        })
                      )}
                    </div>
                    <div className="mt-1 border-t border-gray-100 px-3 pt-2 pb-1.5 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => { navigate('/obavestenja'); setIsNotificationsOpen(false); }}
                        className="text-[11px] font-medium text-[#41ac53] hover:text-[#2f7e3d]"
                      >
                        Prikaži sva obaveštenja
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-gray-400 hover:text-gray-600"
                        onClick={() => setIsNotificationsOpen(false)}
                      >
                        Zatvori
                      </button>
                    </div>
                  </div>
                )}
                </div>

                {user && (
                  <div ref={profileBlockRef} className="flex items-center gap-2">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-medium text-white/95 leading-tight">
                        {user.fullName || user.username}
                      </p>
                      <p className="text-[11px] text-white/80 leading-tight">
                        @{user.username}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(false)
                        setIsNotificationsOpen(false)
                        setIsProfileMenuOpen((v) => !v)
                      }}
                      className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold uppercase text-white shadow-sm hover:bg_white/25 hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/40 overflow-hidden"
                    >
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.fullName || user.username}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>
                          {(user.fullName || user.username || '?')
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      )}
                    </button>
                    {isProfileMenuOpen && (
                      <div className="absolute right-0 top-11 w-44 rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/5 z-50">
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false)
                            navigate('/profil')
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Moj profil
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false)
                            navigate('/profil/podesavanja')
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Podešavanja profila
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false)
                            handleLogout()
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        >
                          Odjava
                        </button>
                      </div>
                    )}
                  </div>
                )}
                </div>
                <div className="md:hidden flex items-center gap-1">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
                  aria-expanded={isMenuOpen}
                  aria-label={isMenuOpen ? 'Zatvori meni' : 'Otvori meni'}
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {isMenuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile menu */}
          <div
            className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
              isMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="border-t border-white/20 bg-[#358c43]/50 backdrop-blur-sm px-4 pb-4 pt-3">
              <div className="flex flex-col gap-1">
                <NavLink
                  to="/akcije"
                  className={({ isActive }) =>
                    `rounded-xl px-4 py-3 text-base font-medium transition-colors ${
                      isActive ? 'bg-white/20 text-white' : 'text-white/90 hover:bg-white/15'
                    }`
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  Akcije
                </NavLink>
                <NavLink
                  to="/zadaci"
                  className={({ isActive }) =>
                    `rounded-xl px-4 py-3 text-base font-medium transition-colors ${
                      isActive ? 'bg-white/20 text-white' : 'text-white/90 hover:bg-white/15'
                    }`
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  Zadaci
                </NavLink>
                <NavLink
                  to="/users"
                  className={({ isActive }) =>
                    `rounded-xl px-4 py-3 text-base font-medium transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-white/90 hover:bg-white/15'}`
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  Članovi
                </NavLink>
                {(user?.role === 'admin' || user?.role === 'blagajnik') && (
                  <NavLink
                    to="/finansije"
                    className={({ isActive }) =>
                      `rounded-xl px-4 py-3 text-base font-medium transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-white/90 hover:bg-white/15'}`
                    }
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Finansije
                  </NavLink>
                )}
                <button
                  onClick={handleLogout}
                  className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-base font-medium text-white/90 hover:bg-white/15 transition-colors"
                >
                  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Odjava
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      {isLoggedIn && isSearchOpen && (
        <div ref={searchPanelRef} className="hidden md:block border-b border-gray-100 bg-white/95 shadow-sm">
          <GlobalSearchPanel
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onClose={() => setIsSearchOpen(false)}
            canSeeFinances={user?.role === 'admin' || user?.role === 'blagajnik' || false}
            embedded
          />
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 pt-6 pb-20 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      {isLoggedIn && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#2e8b4a] bg-[#41ac53] text-white backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-7xl items-center px-2 py-3">
            {/* Home */}
            <div className="flex-1 flex justify-center">
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="flex flex-col items-center justify-center text-xs font-medium text-white/90"
                aria-label="Home"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 border border-white/40 text-white shadow-sm">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M3 11l9-7 9 7v8a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4H9v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z"
                    />
                  </svg>
                </span>
              </button>
            </div>

            {/* Obaveštenja */}
            <div className="flex-1 flex justify-center">
              <button
                ref={mobileNotificationsButtonRef}
                type="button"
                onClick={() => {
                  setIsSearchOpen(false)
                  setIsProfileMenuOpen(false)
                  setIsNotificationsOpen((v) => !v)
                }}
                className="relative flex flex-col items-center justify-center text-xs font-medium text-white/90"
                aria-label="Obaveštenja"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 border border-white/40 text-white shadow-sm">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m1 0v1a2 2 0 104 0v-1m-4 0h4" />
                  </svg>
                </span>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-1/4 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white shadow-sm">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Poruke (chat) */}
            <div className="flex-1 flex justify-center">
              <button
                type="button"
                className="flex flex-col items-center justify-center text-xs font-medium text-white/90"
                aria-label="Poruke"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 border border-white/40 text-white shadow-sm">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </span>
              </button>
            </div>

            {/* Pretraga */}
            <div className="flex-1 flex justify-center">
              <button
                type="button"
                onClick={() => navigate('/search')}
                className="flex flex-col items-center justify-center text-xs font-medium text-white/90"
                aria-label="Pretraga"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 border border-white/40 text-white shadow-sm">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
              </button>
            </div>

            {/* Profil */}
            <div className="flex-1 flex justify-center">
              <button
                type="button"
                onClick={() => navigate('/profil')}
                className="flex flex-col items-center justify-center text-xs font-medium text-white/90"
                aria-label="Profil"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 border border-white/80 text-[#41ac53] shadow-sm overflow-hidden">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.fullName || user.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-semibold">
                      {(user?.fullName || user?.username || '?')
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile notifications overlay */}
      {isLoggedIn && isNotificationsOpen && (
        <div className="fixed inset-0 z-50 md:hidden" ref={mobileNotificationsPanelRef}>
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden
            onClick={() => setIsNotificationsOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Obaveštenja</p>
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(false)}
                className="p-2 -m-2 rounded-full text-gray-500 hover:bg-gray-100"
                aria-label="Zatvori"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              {notificationsLoading ? (
                <p className="px-4 py-6 text-sm text-gray-500">Učitavanje...</p>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-500">Nema obaveštenja.</p>
              ) : (
                <div className="py-1">
                  {notifications.map((n) => {
                    const iconClass =
                      n.type === 'uplata'
                        ? 'bg-green-100 text-green-600'
                        : n.type === 'akcija'
                          ? 'bg-blue-100 text-blue-600'
                          : n.type === 'zadatak'
                            ? 'bg-yellow-100 text-yellow-700'
                            : n.type === 'broadcast'
                              ? 'bg-violet-100 text-violet-600'
                              : 'bg-gray-100 text-gray-600'
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 ${!n.readAt ? 'bg-green-50/50' : ''}`}
                      >
                        <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m1 0v1a2 2 0 104 0v-1m-4 0h4" />
                          </svg>
                        </span>
                        <span className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          {n.body && <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{n.body}</p>}
                          <p className="mt-0.5 text-xs text-gray-400">{formatRelativeTime(n.createdAt)}</p>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => {
                  navigate('/obavestenja')
                  setIsNotificationsOpen(false)
                }}
                className="text-sm font-medium text-[#41ac53] hover:text-[#2f7e3d]"
              >
                Prikaži sva obaveštenja
              </button>
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}