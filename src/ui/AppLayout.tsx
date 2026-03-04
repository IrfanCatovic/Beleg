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
                      className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold uppercase text-white shadow-sm hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/40"
                    >
                      <span>
                        {(user.fullName || user.username || '?')
                          .charAt(0)
                          .toUpperCase()}
                      </span>
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
                  to="/home"
                  className={({ isActive }) =>
                    `rounded-xl px-4 py-3 text-base font-medium transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-white/90 hover:bg-white/15'}`
                  }
                  onClick={() => setIsMenuOpen(false)}
                  end
                >
                  Home
                </NavLink>
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
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-2.5">
            <button
              type="button"
              onClick={() => navigate('/profil')}
              className="flex flex-col items-center justify-center text-xs font-medium text-gray-700"
            >
              <span className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#41ac53]/10 text-[#41ac53]">
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
                    d="M5.121 17.804A9 9 0 0112 15a9 9 0 016.879 2.804M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </span>
              Profil
            </button>
          </div>
        </div>
      )}
    </div>
  )
}