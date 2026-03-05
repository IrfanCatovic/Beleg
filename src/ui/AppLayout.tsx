import { useEffect, useState } from 'react'
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCmdK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
      if (isCmdK) {
        event.preventDefault()
        setIsSearchOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
            <div className="flex h-14 sm:h-16 items-center gap-4">
              <div className="flex items-center gap-6">
                <Link
                  to="/home"
                  className="shrink-0 text-lg font-bold tracking-tight sm:text-xl md:text-2xl text-white hover:text-white/95 transition-colors"
                >
                  Adri Sentinel
                </Link>

                <nav className="hidden md:flex md:items-center md:gap-1">
                  <NavLink to="/home" className={navLinkClass} end>
                    Home
                  </NavLink>
                  <NavLink to="/akcije" className={navLinkClass}>
                    Akcije
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
              </div>

              <div className="hidden lg:flex flex-1 items-center justify-center px-4">
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="group flex w-full max-w-xl items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 shadow-sm ring-1 ring-white/20 hover:bg-white/15 hover:ring-white/40 transition-all"
                >
                  <svg
                    className="h-4 w-4 text-white/80"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M11 5a6 6 0 104.472 10.03L19 18.5 18.5 19l-3.528-3.47A6 6 0 1011 5z"
                    />
                  </svg>
                  <span className="flex-1 text-left text-xs sm:text-sm text-white/80">
                    Pretraži članove, akcije, finansije...
                  </span>
                  <span className="hidden sm:flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/80 border border-white/20">
                    <span className="font-mono">Ctrl</span>
                    <span>+</span>
                    <span className="font-mono">K</span>
                  </span>
                </button>
              </div>

              <div className="ml-auto hidden md:flex md:items-center md:gap-3 relative">
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen((v) => !v)}
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
                  <span className="absolute -top-1 -right-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white shadow-sm">
                    3
                  </span>
                </button>

                {isNotificationsOpen && (
                  <div className="absolute right-0 top-11 w-80 rounded-2xl bg-white py-2 shadow-xl ring-1 ring-black/5 z-40">
                    <div className="flex items-center justify-between px-3 pb-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-800">Obaveštenja</p>
                      <span className="text-[11px] text-gray-400">Danas</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
                      >
                        <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600">
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.8}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </span>
                        <span className="flex-1">
                          <p className="text-xs font-medium text-gray-900">
                            Uspješno evidentirana nova uplata članarine.
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-500">Prije 5 minuta</p>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
                      >
                        <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.8}
                              d="M13 16h-1v-4h-1m1-4h.01M12 21a9 9 0 110-18 9 9 0 010 18z"
                            />
                          </svg>
                        </span>
                        <span className="flex-1">
                          <p className="text-xs font-medium text-gray-900">
                            Nova akcija je dodata u kalendar.
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-500">Prije 1 sat</p>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
                      >
                        <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.8}
                              d="M12 9v2m0 4h.01M4.93 4.93l14.14 14.14M12 5a7 7 0 017 7c0 1.657-.6 3.176-1.6 4.356M5.6 16.356A6.97 6.97 0 015 12a7 7 0 017-7"
                            />
                          </svg>
                        </span>
                        <span className="flex-1">
                          <p className="text-xs font-medium text-gray-900">
                            Podsjetnik: rok za uplatu kotizacije ističe sutra.
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-500">Prije 3 sata</p>
                        </span>
                      </button>
                    </div>
                    <div className="mt-1 border-t border-gray-100 px-3 pt-2 pb-1.5 flex items-center justify-between">
                      <button
                        type="button"
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

                {user && (
                  <>
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
                      onClick={() => setIsProfileMenuOpen((v) => !v)}
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
                  </>
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
                    `rounded-xl px-4 py-3 text-base font-medium transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-white/90 hover:bg-white/15'}`
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  Akcije
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

      <main className="mx-auto max-w-7xl px-4 pt-6 pb-20 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-24 sm:pt-28">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M11 5a6 6 0 104.472 10.03L19 18.5 18.5 19l-3.528-3.47A6 6 0 1011 5z"
                />
              </svg>
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pretraži članove, akcije, finansije, transakcije..."
                className="flex-1 border-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Esc
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto px-2 py-2">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Brzi linkovi
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false)
                  navigate('/users')
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#41ac53]/10 text-[#41ac53]">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M17 20h5V4H2v16h5m10 0V10m0 10h-4m4 0h4M7 20v-6m0 6H3m4 0h4"
                    />
                  </svg>
                </span>
                <span>
                  <span className="block text-xs font-medium text-gray-900">
                    Lista članova
                  </span>
                  <span className="block text-[11px] text-gray-500">
                    Prikaži sve članove i profile
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false)
                  navigate('/akcije')
                }}
                className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M12 8v8m-4-4h8m5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </span>
                <span>
                  <span className="block text-xs font-medium text-gray-900">
                    Akcije i događaji
                  </span>
                  <span className="block text-[11px] text-gray-500">
                    Otvori pregled svih akcija
                  </span>
                </span>
              </button>
              {(user?.role === 'admin' || user?.role === 'blagajnik') && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(false)
                    navigate('/finansije')
                  }}
                  className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M12 8c-1.657 0-3 .843-3 2s1.343 2 3 2 3 .843 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.6 1M12 8V6m0 10v2m8-10a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-xs font-medium text-gray-900">
                      Finansije i transakcije
                    </span>
                    <span className="block text-[11px] text-gray-500">
                      Upravljaj uplatama, rashodima i izvještajima
                    </span>
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
                type="button"
                className="flex flex-col items-center justify-center text-xs font-medium text-white/90"
                aria-label="Obaveštenja"
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
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m1 0v1a2 2 0 104 0v-1m-4 0h4"
                    />
                  </svg>
                </span>
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
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M8 10h8M8 14h4m-8 4l2.5-2.5A2 2 0 017.914 15H18a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10z"
                    />
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
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M11 5a6 6 0 104.472 10.03L19 18.5 18.5 19l-3.528-3.47A6 6 0 1011 5z"
                    />
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
    </div>
  )
}