import { useEffect, useRef, useState } from 'react'
import { Outlet, Link, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import GlobalSearchPanel from '../components/GlobalSearchPanel'
import { markObavestenjeRead } from '../services/obavestenja'
import { userHasClubContext } from '../utils/clubContext'
import {
  canSeeFinance,
  iconBtnClass,
  navDropdownLinkClass,
  navDropdownPanelClass,
  navDropdownSoonClass,
  navDropdownTriggerClass,
  navLinkClass,
} from './appLayoutStyles'
import { AppNotificationsBellButton, AppNotificationsPanel } from './AppNotificationsPanel'
import { AppLayoutProfileDropdown } from './AppLayoutProfileDropdown'
import { AppLayoutMobileNav } from './AppLayoutMobileNav'
import { AppLayoutMobileBottomBar } from './AppLayoutMobileBottomBar'
import { useNotifications } from './useNotifications'
import { useNavDropdowns } from './useNavDropdowns'
import type { ObavestenjeItem } from '../types/obavestenje'

export default function AppLayout() {
  const { t } = useTranslation('appLayout')
  const { t: tCommon } = useTranslation('common')
  const { t: tFerrate } = useTranslation('ferrate')
  const { t: tHotels } = useTranslation('hotels')
  const { t: tPeaks } = useTranslation('peaks')
  const { t: tGuides } = useTranslation('guideProfiles')
  const { logout, user, isLoggedIn, pendingSummitReward, clearPendingSummitReward } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isSuperadminNoClub =
    user?.role === 'superadmin' && !localStorage.getItem('superadmin_club_id')
  const hasClubContext = userHasClubContext(user)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchPanelRef = useRef<HTMLDivElement>(null)
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const notificationsBlockRef = useRef<HTMLDivElement>(null)
  const mobileNotificationsPanelRef = useRef<HTMLDivElement>(null)
  const mobileNotificationsButtonRef = useRef<HTMLButtonElement>(null)
  const profileBlockRef = useRef<HTMLDivElement>(null)
  const pullStartYRef = useRef<number | null>(null)
  const pullDistanceRef = useRef(0)
  const pullTrackingRef = useRef(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [pullRefreshing, setPullRefreshing] = useState(false)
  const [summitRewardDismissed, setSummitRewardDismissed] = useState(false)

  const {
    notifications,
    notificationsLoading,
    unreadCount,
    setUnreadCount,
    totalPendingRequests,
    hasPendingRequests,
    isNotificationsOpen,
    setIsNotificationsOpen,
  } = useNotifications(isLoggedIn, isSuperadminNoClub)

  const {
    navExploreOpen,
    setNavExploreOpen,
    navClubOpen,
    setNavClubOpen,
    mobileExploreOpen,
    setMobileExploreOpen,
    mobileClubOpen,
    setMobileClubOpen,
    navExploreRef,
    navClubRef,
    closeNavDropdowns,
  } = useNavDropdowns(isMenuOpen)

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
  }, [setIsNotificationsOpen])

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
  }, [isSearchOpen, isNotificationsOpen, isProfileMenuOpen, setIsNotificationsOpen])

  useEffect(() => {
    pullDistanceRef.current = pullDistance
  }, [pullDistance])

  useEffect(() => {
    setSummitRewardDismissed(false)
  }, [pendingSummitReward?.notificationId])

  useEffect(() => {
    if (!isLoggedIn) return
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
    if (!coarsePointer) return

    const threshold = 72

    const onTouchStart = (event: TouchEvent) => {
      if (pullRefreshing) return
      if (event.touches.length !== 1) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (window.scrollY > 0) return
      pullStartYRef.current = event.touches[0].clientY
      pullTrackingRef.current = true
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!pullTrackingRef.current || pullStartYRef.current == null || pullRefreshing) return
      const currentY = event.touches[0].clientY
      const delta = currentY - pullStartYRef.current

      if (delta <= 0) {
        setPullDistance(0)
        return
      }
      if (window.scrollY > 0) {
        setPullDistance(0)
        return
      }

      const damped = Math.min(110, delta * 0.55)
      setPullDistance(damped)
      if (delta > 8) event.preventDefault()
    }

    const endPull = () => {
      pullTrackingRef.current = false
      pullStartYRef.current = null
      if (pullRefreshing) return

      if (pullDistanceRef.current >= threshold) {
        setPullRefreshing(true)
        setPullDistance(threshold)
        window.setTimeout(() => {
          window.location.reload()
        }, 140)
        return
      }
      setPullDistance(0)
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', endPull, { passive: true })
    window.addEventListener('touchcancel', endPull, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', endPull)
      window.removeEventListener('touchcancel', endPull)
    }
  }, [isLoggedIn, pullRefreshing])

  const handleNotificationClick = (n: ObavestenjeItem) => {
    if (!n.readAt) {
      void markObavestenjeRead(n.id).then(() => setUnreadCount((c) => Math.max(0, c - 1)))
    }
    setIsNotificationsOpen(false)
    if ((n.type === 'akcija' || n.type === 'summit_reward') && n.link?.trim()) {
      navigate(n.link.trim())
      return
    }
    navigate(`/obavestenja/${n.id}`)
  }

  const handleLogout = () => {
    if (user?.role === 'superadmin') {
      localStorage.removeItem('superadmin_club_id')
      localStorage.removeItem('superadmin_club_name')
    }
    logout()
    navigate('/', { replace: true })
    setIsMenuOpen(false)
  }

  if (isSuperadminNoClub && !location.pathname.startsWith('/superadmin')) {
    return <Navigate to="/superadmin" replace />
  }

  const exploreNavActive =
    location.pathname.startsWith('/ferate') ||
    location.pathname === '/vodici' ||
    location.pathname === '/mapa'
  const clubNavActive =
    location.pathname === '/klub' ||
    location.pathname.startsWith('/klubovi') ||
    location.pathname.startsWith('/users') ||
    location.pathname === '/zadaci' ||
    location.pathname === '/finansije'
  const showSummitRewardModal = !!(isLoggedIn && pendingSummitReward && !summitRewardDismissed)
  const summitActionName = pendingSummitReward?.actionName?.trim() || 'akciju'
  const requestsSummaryMobileClass = hasPendingRequests
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700'

  const handleSummitRewardClaim = async () => {
    if (!pendingSummitReward) return
    setSummitRewardDismissed(true)
    if (pendingSummitReward.notificationId) {
      await markObavestenjeRead(pendingSummitReward.notificationId).catch(() => {})
    }
    clearPendingSummitReward()
    if (pendingSummitReward.actionId) {
      navigate(`/akcije/${pendingSummitReward.actionId}?claimReward=1`)
      return
    }
    if (pendingSummitReward.link?.trim()) {
      navigate(pendingSummitReward.link.trim())
      return
    }
    navigate('/akcije')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {(pullDistance > 0 || pullRefreshing) && (
        <div
          className="fixed left-1/2 z-[70] -translate-x-1/2 rounded-full bg-slate-900/90 px-3 py-1.5 text-white shadow-lg backdrop-blur-sm md:hidden"
          style={{ top: `${Math.min(16 + pullDistance * 0.5, 56)}px` }}
          aria-hidden="true"
        >
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold">
            <span className={`inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white ${pullRefreshing ? 'animate-spin' : ''}`} />
            {pullRefreshing ? 'Osvezavanje...' : pullDistance >= 72 ? 'Pusti da osvezis' : 'Povuci nadole'}
          </span>
        </div>
      )}
      {isLoggedIn && (
        <header className="sticky top-0 z-40 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-white/[0.06]">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 sm:h-[60px] items-center justify-between gap-4">
              <div className="flex items-center gap-8">
                <Link
                  to={isSuperadminNoClub ? '/superadmin' : '/home'}
                  className="shrink-0 flex items-center gap-2 group"
                >
                  <img
                    src="/LogoP.jpg"
                    alt={tCommon('appName')}
                    className="h-8 w-8 rounded-lg shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/30 transition-shadow"
                  />
                  <span className="hidden sm:block text-[15px] font-bold tracking-tight text-white">
                    {tCommon('appName')}
                  </span>
                </Link>

                {!isSuperadminNoClub && (
                <nav className="hidden md:flex items-center gap-0.5">
                  <NavLink to="/home" className={navLinkClass}>
                    {t('home')}
                  </NavLink>
                  <NavLink to="/akcije" className={navLinkClass}>
                    {t('actions')}
                  </NavLink>

                  <div className="relative" ref={navExploreRef}>
                    <button
                      type="button"
                      className={navDropdownTriggerClass(navExploreOpen, exploreNavActive)}
                      aria-expanded={navExploreOpen}
                      aria-haspopup="menu"
                      onClick={() => {
                        setNavExploreOpen((v) => !v)
                        setNavClubOpen(false)
                        setIsSearchOpen(false)
                        setIsNotificationsOpen(false)
                        setIsProfileMenuOpen(false)
                      }}
                    >
                      {t('explore')}
                      <ChevronDownIcon className={`h-4 w-4 shrink-0 opacity-90 transition-transform ${navExploreOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {navExploreOpen && (
                      <div className={navDropdownPanelClass} role="menu">
                        <Link
                          to="/ferate"
                          className={navDropdownLinkClass}
                          role="menuitem"
                          onClick={() => setNavExploreOpen(false)}
                        >
                          {t('exploreFerate')}
                        </Link>
                        <Link
                          to="/vodici"
                          className={navDropdownLinkClass}
                          role="menuitem"
                          onClick={() => setNavExploreOpen(false)}
                        >
                          {t('exploreGuides')}
                        </Link>
                        <Link
                          to="/mapa"
                          className={navDropdownLinkClass}
                          role="menuitem"
                          onClick={() => setNavExploreOpen(false)}
                        >
                          {t('exploreMap')}
                        </Link>
                        <span className={navDropdownSoonClass} role="menuitem" aria-disabled="true">
                          <span>{t('exploreHotels')}</span>
                          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                            {t('exploreComingSoon')}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="relative" ref={navClubRef}>
                    <button
                      type="button"
                      className={navDropdownTriggerClass(navClubOpen, clubNavActive)}
                      aria-expanded={navClubOpen}
                      aria-haspopup="menu"
                      onClick={() => {
                        setNavClubOpen((v) => !v)
                        setNavExploreOpen(false)
                        setIsSearchOpen(false)
                        setIsNotificationsOpen(false)
                        setIsProfileMenuOpen(false)
                      }}
                    >
                      {t('myClubNav')}
                      <ChevronDownIcon className={`h-4 w-4 shrink-0 opacity-90 transition-transform ${navClubOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {navClubOpen && (
                      <div className={navDropdownPanelClass} role="menu">
                        <Link
                          to="/klub"
                          className={navDropdownLinkClass}
                          role="menuitem"
                          onClick={() => setNavClubOpen(false)}
                        >
                          {t('clubOverview')}
                        </Link>
                        {hasClubContext && (
                          <Link
                            to="/users"
                            className={navDropdownLinkClass}
                            role="menuitem"
                            onClick={() => setNavClubOpen(false)}
                          >
                            {t('members')}
                          </Link>
                        )}
                        {hasClubContext && (
                          <Link
                            to="/zadaci"
                            className={navDropdownLinkClass}
                            role="menuitem"
                            onClick={() => setNavClubOpen(false)}
                          >
                            {t('tasks')}
                          </Link>
                        )}
                        {canSeeFinance(user?.role) && (
                          <Link
                            to="/finansije"
                            className={navDropdownLinkClass}
                            role="menuitem"
                            onClick={() => setNavClubOpen(false)}
                          >
                            {t('finances')}
                          </Link>
                        )}
                      </div>
                    )}
                  </div>

                  {user?.role === 'superadmin' && (
                    <>
                      <span className="mx-1 hidden h-5 w-px self-center bg-white/15 lg:block" aria-hidden />
                      <NavLink to="/superadmin" end className={navLinkClass}>
                        {t('clubs')}
                      </NavLink>
                      <NavLink to="/superadmin/hoteli" className={navLinkClass}>
                        {tHotels('title')}
                      </NavLink>
                      <NavLink to="/superadmin/vrhovi" className={navLinkClass}>
                        {tPeaks('title')}
                      </NavLink>
                      <NavLink to="/superadmin/vodici-profiles" className={navLinkClass}>
                        {tGuides('superadmin.nav')}
                      </NavLink>
                    </>
                  )}
                </nav>
                )}
                {isSuperadminNoClub && (
                  <nav className="hidden md:flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-sm text-white/70">{t('chooseClub')}</span>
                    <NavLink to="/superadmin" end className={navLinkClass}>
                      {t('clubs')}
                    </NavLink>
                    <NavLink to="/superadmin/ferrate" className={navLinkClass}>
                      {tFerrate('superadminTitle')}
                    </NavLink>
                    <NavLink to="/superadmin/hoteli" className={navLinkClass}>
                      {tHotels('title')}
                    </NavLink>
                    <NavLink to="/superadmin/vrhovi" className={navLinkClass}>
                      {tPeaks('title')}
                    </NavLink>
                    <NavLink to="/superadmin/vodici-profiles" className={navLinkClass}>
                      {tGuides('superadmin.nav')}
                    </NavLink>
                  </nav>
                )}
                {user?.role === 'superadmin' && !isSuperadminNoClub && (
                  <div className="hidden md:flex items-center gap-2 ml-2 pl-2 border-l border-white/20">
                    <span className="text-[12px] text-white/80 font-medium whitespace-nowrap">
                      {t('enteredClub')} <span className="text-white font-semibold">{localStorage.getItem('superadmin_club_name') || t('club')}</span>
                    </span>
                    <Link
                      to="/superadmin"
                      className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 whitespace-nowrap transition-colors"
                    >
                      {t('changeClub')}
                    </Link>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden md:flex md:items-center md:gap-1.5">
                  {!isSuperadminNoClub && (
                  <>
                  <button
                    ref={searchButtonRef}
                    type="button"
                    onClick={() => {
                      setIsNotificationsOpen(false)
                      setIsProfileMenuOpen(false)
                      closeNavDropdowns()
                      setIsSearchOpen((v) => !v)
                    }}
                    className={iconBtnClass}
                    aria-label={t('search')}
                  >
                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.5 4.5a6 6 0 014.615 9.847l3.769 3.768-1.414 1.415-3.768-3.769A6 6 0 1110.5 4.5z" />
                    </svg>
                  </button>

                  <div ref={notificationsBlockRef} className="relative">
                    <AppNotificationsBellButton
                      open={isNotificationsOpen}
                      unreadCount={unreadCount}
                      hasPendingRequests={hasPendingRequests}
                      onToggle={() => {
                        setIsSearchOpen(false)
                        setIsProfileMenuOpen(false)
                        closeNavDropdowns()
                        setIsNotificationsOpen((v) => !v)
                      }}
                    />
                    <AppNotificationsPanel
                      open={isNotificationsOpen}
                      loading={notificationsLoading}
                      notifications={notifications}
                      hasPendingRequests={hasPendingRequests}
                      totalPendingRequests={totalPendingRequests}
                      requestsSummaryClass={requestsSummaryMobileClass}
                      onClose={() => setIsNotificationsOpen(false)}
                      onUnreadCountChange={setUnreadCount}
                      variant="desktop"
                    />
                  </div>
                  </>
                  )}

                  {!isSuperadminNoClub && (
                  <div className="h-6 w-px bg-white/10 mx-1.5" />
                  )}
                  {user && (
                    <AppLayoutProfileDropdown
                      profileBlockRef={profileBlockRef}
                      user={user}
                      isProfileMenuOpen={isProfileMenuOpen}
                      setIsProfileMenuOpen={setIsProfileMenuOpen}
                      setIsSearchOpen={setIsSearchOpen}
                      setIsNotificationsOpen={setIsNotificationsOpen}
                      setNavExploreOpen={setNavExploreOpen}
                      setNavClubOpen={setNavClubOpen}
                      onLogout={handleLogout}
                      t={t}
                    />
                  )}
                </div>

              </div>
            </div>
          </div>

          <AppLayoutMobileNav
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
            mobileExploreOpen={mobileExploreOpen}
            setMobileExploreOpen={setMobileExploreOpen}
            mobileClubOpen={mobileClubOpen}
            setMobileClubOpen={setMobileClubOpen}
            user={user}
            isSuperadminNoClub={isSuperadminNoClub}
            hasClubContext={hasClubContext}
            onLogout={handleLogout}
            t={t}
            tFerrate={tFerrate}
            tHotels={tHotels}
            tPeaks={tPeaks}
            tGuides={tGuides}
          />
        </header>
      )}

      {isLoggedIn && !isSuperadminNoClub && isSearchOpen && (
        <div ref={searchPanelRef} className="hidden md:block border-b border-gray-100 bg-white/95 backdrop-blur-sm shadow-sm">
          <GlobalSearchPanel
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onClose={() => setIsSearchOpen(false)}
            canSeeFinances={canSeeFinance(user?.role)}
            embedded
          />
        </div>
      )}

      <main className="mx-auto max-w-[1440px] px-4 pt-6 pb-20 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      {isLoggedIn && !isSuperadminNoClub && (
        <AppLayoutMobileBottomBar
          user={user}
          unreadCount={unreadCount}
          hasPendingRequests={hasPendingRequests}
          totalPendingRequests={totalPendingRequests}
          isNotificationsOpen={isNotificationsOpen}
          setIsNotificationsOpen={setIsNotificationsOpen}
          setIsSearchOpen={setIsSearchOpen}
          setIsProfileMenuOpen={setIsProfileMenuOpen}
          mobileNotificationsButtonRef={mobileNotificationsButtonRef}
          mobileNotificationsPanelRef={mobileNotificationsPanelRef}
          notificationsLoading={notificationsLoading}
          notifications={notifications}
          requestsSummaryMobileClass={requestsSummaryMobileClass}
          onNotificationClick={handleNotificationClick}
          t={t}
        />
      )}

      {showSummitRewardModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]">
          <div className="relative w-full max-w-md rounded-2xl bg-white border border-emerald-100 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50">
              <h2 className="text-base font-extrabold text-gray-900 tracking-tight">Cestitamo!</h2>
              <button
                type="button"
                onClick={() => setSummitRewardDismissed(true)}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-500 hover:bg-white/80 hover:text-gray-800"
                aria-label={t('close')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700">
                Uspesno ste popeli akciju <span className="font-bold text-gray-900">{summitActionName}</span>.
              </p>
              <button
                type="button"
                onClick={() => void handleSummitRewardClaim()}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-500 hover:from-emerald-400 hover:via-teal-500 hover:to-emerald-400 shadow-md shadow-emerald-200/50 border border-emerald-400/30 transition-all"
              >
                Preuzmi nagradu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
