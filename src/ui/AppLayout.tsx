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
                <NavLink to="/profil" className={navLinkClass}>
                  Profil
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

              <div className="hidden md:flex md:items-center md:gap-2">
                {user?.fullName && (
                  <span className="max-w-[140px] truncate rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/95">
                    {user.fullName}
                  </span>
                )}
                <button
                  onClick={handleLogout}
                  title="Odjava"
                  className="rounded-xl p-2 text-white/90 hover:bg-white/15 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#41ac53]"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
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
                  to="/profil"
                  className={({ isActive }) =>
                    `rounded-xl px-4 py-3 text-base font-medium transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-white/90 hover:bg-white/15'}`
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  Profil
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

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}