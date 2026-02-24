import { useState } from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AppLayout() {
  const { user, logout, isLoggedIn } = useAuth() // ← dodaj isLoggedIn ako ga imaš u context-u
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
    setIsMenuOpen(false)
  }

  // Ako nije ulogovan ne prikazuj header uopšte
  if (!isLoggedIn) {
    return <Outlet /> 
  }

  // Ako je ulogovan prikaži header
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header samo za ulogovane */}
      <header className="bg-[#41ac53] text-white shadow-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link to="/home" className="text-xl font-bold sm:text-2xl">
                Adri Sentinel
              </Link>
            </div>

            {/* Hamburger za telefon */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-[#fed74c]/20 focus:outline-none"
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

            {/* Desktop meni samo za ulogovane */}
            <nav className="hidden md:flex md:space-x-8">
              <Link to="/home" className="rounded-md px-3 py-2 text-base font-medium hover:bg-[#fed74c]/30 transition">
                Početna
              </Link>

              <Link to="/akcije" className="rounded-md px-3 py-2 text-base font-medium hover:bg-[#fed74c]/30 transition">
                Akcije
              </Link>

              <Link to="/profil" className="rounded-md px-3 py-2 text-base font-medium hover:bg-[#fed74c]/30 transition">
                Profil
              </Link>

              {/* Admin-only linkovi */}
              {user?.role === 'admin' && (
                <>
                  <Link to="/finansije" className="rounded-md px-3 py-2 text-base font-medium hover:bg-[#fed74c]/30 transition">
                    Finansije
                  </Link>

                  <Link to="/users" className="rounded-md px-3 py-2 text-base font-medium hover:bg-[#fed74c]/30 transition">
                    Korisnici
                  </Link>

                  <Link to="/dodaj-korisnika" className="rounded-md px-3 py-2 text-base font-medium hover:bg-[#fed74c]/30 transition">
                    Dodaj korisnika
                  </Link>
                </>
              )}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="rounded-md px-3 py-2 text-base font-medium hover:bg-[#fed74c]/30 transition"
              >
                Odjavi se
              </button>
            </nav>
          </div>
        </div>

        {/* Mobilni meni samo za ulogovane */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="space-y-1 px-2 pb-3 pt-2">
              <Link
                to="/home"
                className="block rounded-md px-3 py-2 text-base font-medium hover:bg-[#fed74c]/30"
                onClick={() => setIsMenuOpen(false)}
              >
                Početna
              </Link>

              <Link
                to="/akcije"
                className="block rounded-md px-3 py-2 text-base font-medium hover:bg-[#fed74c]/30"
                onClick={() => setIsMenuOpen(false)}
              >
                Akcije
              </Link>

              <Link
                to="/profil"
                className="block rounded-md px-3 py-2 text-base font-medium hover:bg-[#fed74c]/30"
                onClick={() => setIsMenuOpen(false)}
              >
                Profil
              </Link>

              {/* Admin-only u mobilnom meniju */}
              {user?.role === 'admin' && (
                <>
                  <Link
                    to="/finansije"
                    className="block rounded-md px-3 py-2 text-base font-medium hover:bg-[#fed74c]/30"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Finansije
                  </Link>

                  <Link
                    to="/users"
                    className="block rounded-md px-3 py-2 text-base font-medium hover:bg-[#fed74c]/30"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Korisnici
                  </Link>

                  <Link
                    to="/dodaj-korisnika"
                    className="block rounded-md px-3 py-2 text-base font-medium hover:bg-[#fed74c]/30"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Dodaj korisnika
                  </Link>
                </>
              )}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="block w-full rounded-md px-3 py-2 text-left text-base font-medium hover:bg-[#fed74c]/30"
              >
                Odjavi se
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Glavni sadržaj */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}