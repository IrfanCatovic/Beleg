import { Link, NavLink } from 'react-router-dom'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import type { TFunction } from 'i18next'
import type { User } from '../context/AuthContext'
import { canSeeFinance, mobileExploreSoonClass } from './appLayoutStyles'

export interface AppLayoutMobileNavProps {
  isMenuOpen: boolean
  setIsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  mobileExploreOpen: boolean
  setMobileExploreOpen: React.Dispatch<React.SetStateAction<boolean>>
  mobileClubOpen: boolean
  setMobileClubOpen: React.Dispatch<React.SetStateAction<boolean>>
  user: User | null
  isSuperadminNoClub: boolean
  hasClubContext: boolean
  onLogout: () => void
  t: TFunction
  tFerrate: TFunction
  tHotels: TFunction
  tPeaks: TFunction
  tGuides: TFunction
}

export function AppLayoutMobileNav({
  isMenuOpen,
  setIsMenuOpen,
  mobileExploreOpen,
  setMobileExploreOpen,
  mobileClubOpen,
  setMobileClubOpen,
  user,
  isSuperadminNoClub,
  hasClubContext,
  onLogout,
  t,
  tFerrate,
  tHotels,
  tPeaks,
  tGuides,
}: AppLayoutMobileNavProps) {
  const handleLogout = onLogout
  return (
    <>
          {/* Mobile menu – dovoljna visina + scroll da superadmin vidi sve do Odjave */}
          <div
            className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
              isMenuOpen
                ? 'max-h-[min(85vh,720px)] opacity-100'
                : 'max-h-0 opacity-0 pointer-events-none'
            }`}
          >
            <div className="max-h-[min(85vh,720px)] overflow-y-auto overscroll-contain border-t border-white/[0.06] bg-slate-800/80 backdrop-blur-xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
              <div className="flex flex-col gap-0.5 pb-1">
                {user?.role === 'superadmin' && isSuperadminNoClub && (
                  <div className="mb-2 flex flex-col gap-0.5 border-b border-white/10 pb-2">
                    <p className="px-1 text-[12px] text-white/70">{t('chooseClub')}</p>
                    <NavLink
                      to="/superadmin"
                      end
                      className={({ isActive }) =>
                        `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                          isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                        }`
                      }
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {t('clubs')}
                    </NavLink>
                    <NavLink
                      to="/superadmin/ferrate"
                      className={({ isActive }) =>
                        `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                          isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                        }`
                      }
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {tFerrate('superadminTitle')}
                    </NavLink>
                    <NavLink
                      to="/superadmin/hoteli"
                      className={({ isActive }) =>
                        `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                          isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                        }`
                      }
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {tHotels('title')}
                    </NavLink>
                    <NavLink
                      to="/superadmin/vrhovi"
                      className={({ isActive }) =>
                        `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                          isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                        }`
                      }
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {tPeaks('title')}
                    </NavLink>
                    <NavLink
                      to="/superadmin/vodici-profiles"
                      className={({ isActive }) =>
                        `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                          isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                        }`
                      }
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {tGuides('superadmin.nav')}
                    </NavLink>
                  </div>
                )}
                {user?.role === 'superadmin' && !isSuperadminNoClub && (
                  <div className="mb-2 pb-2 border-b border-white/10 flex flex-col gap-1.5">
                    <p className="text-[12px] text-white/70 font-medium">
                      {t('enteredClub')} <span className="text-white font-semibold">{localStorage.getItem('superadmin_club_name') || t('club')}</span>
                    </p>
                    <Link
                      to="/superadmin"
                      onClick={() => setIsMenuOpen(false)}
                      className="text-[13px] font-semibold text-emerald-300 hover:text-emerald-200"
                    >
                      {t('changeClub')}
                    </Link>
                  </div>
                )}
                {!isSuperadminNoClub && (
                <>
                <NavLink
                  to="/home"
                  className={({ isActive }) =>
                    `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                      isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                    }`
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t('home')}
                </NavLink>
                <NavLink
                  to="/akcije"
                  className={({ isActive }) =>
                    `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                      isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                    }`
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t('actions')}
                </NavLink>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-[15px] font-semibold text-white"
                    aria-expanded={mobileExploreOpen}
                    onClick={() => setMobileExploreOpen((v) => !v)}
                  >
                    <span>{t('explore')}</span>
                    <ChevronDownIcon className={`h-5 w-5 shrink-0 text-white/70 transition-transform ${mobileExploreOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileExploreOpen && (
                    <div className="border-t border-white/10 bg-black/15 px-2 py-2 flex flex-col gap-0.5">
                      <Link
                        to="/ferate"
                        className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-white/90 hover:bg-white/[0.07]"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {t('exploreFerate')}
                      </Link>
                      <Link
                        to="/vodici"
                        className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-white/90 hover:bg-white/[0.07]"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {t('exploreGuides')}
                      </Link>
                      <Link
                        to="/mapa"
                        className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-white/90 hover:bg-white/[0.07]"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {t('exploreMap')}
                      </Link>
                      <span className={mobileExploreSoonClass} aria-disabled="true">
                        <span>{t('exploreHotels')}</span>
                        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                          {t('exploreComingSoon')}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-[15px] font-semibold text-white"
                    aria-expanded={mobileClubOpen}
                    onClick={() => setMobileClubOpen((v) => !v)}
                  >
                    <span>{t('myClubNav')}</span>
                    <ChevronDownIcon className={`h-5 w-5 shrink-0 text-white/70 transition-transform ${mobileClubOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileClubOpen && (
                    <div className="border-t border-white/10 bg-black/15 px-2 py-2 flex flex-col gap-0.5">
                      <Link
                        to="/klub"
                        className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-white/90 hover:bg-white/[0.07]"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {t('clubOverview')}
                      </Link>
                      {hasClubContext && (
                        <Link
                          to="/users"
                          className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-white/90 hover:bg-white/[0.07]"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t('members')}
                        </Link>
                      )}
                      {hasClubContext && (
                        <Link
                          to="/zadaci"
                          className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-white/90 hover:bg-white/[0.07]"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t('tasks')}
                        </Link>
                      )}
                      {canSeeFinance(user?.role) && (
                        <Link
                          to="/finansije"
                          className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-white/90 hover:bg-white/[0.07]"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t('finances')}
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                {user?.role === 'superadmin' && (
                  <>
                    <p className="px-1 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                      Superadmin
                    </p>
                    <NavLink
                      to="/superadmin"
                      end
                      className={({ isActive }) =>
                        `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                          isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                        }`
                      }
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {t('clubs')}
                    </NavLink>
                    <NavLink
                      to="/superadmin/hoteli"
                      className={({ isActive }) =>
                        `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                          isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                        }`
                      }
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {tHotels('title')}
                    </NavLink>
                    <NavLink
                      to="/superadmin/vrhovi"
                      className={({ isActive }) =>
                        `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                          isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                        }`
                      }
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {tPeaks('title')}
                    </NavLink>
                    <NavLink
                      to="/superadmin/vodici-profiles"
                      className={({ isActive }) =>
                        `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                          isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                        }`
                      }
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {tGuides('superadmin.nav')}
                    </NavLink>
                  </>
                )}
                </>
                )}
                <div className="mt-2 pt-2 border-t border-white/[0.06]">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] font-medium text-rose-400 hover:bg-white/[0.06] transition-colors"
                  >
                    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {t('logout')}
                  </button>
                </div>
              </div>
            </div>
          </div>
    </>
  )
}
