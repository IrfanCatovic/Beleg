import { useState } from 'react'
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
            <div className="flex h-14 sm:h-16 items-center justify-between gap-4">
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
                  Korisnici
                </NavLink>
                {(user?.role === 'admin' || user?.role === 'blagajnik') && (
                  <NavLink to="/finansije" className={navLinkClass}>
                    Finansije
                  </NavLink>
                )}
              </nav>

              <div className="hidden md:flex md:items-center md:gap-3 relative">
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
                      className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold uppercase text-white shadow-sm hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/40 overflow-hidden"
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
                  Korisnici
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