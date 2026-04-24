import { useEffect, useRef, useState } from 'react'
import { Outlet, Link, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import GlobalSearchPanel from '../components/GlobalSearchPanel'
import api from '../services/api'
import { formatRelativeTime } from '../utils/dateUtils'
import { userHasClubContext } from '../utils/clubContext'
import { obavestenjeBellIconClass } from '../utils/obavestenjeIconClass'
import LanguageSwitcher from '../components/LanguageSwitcher'

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

interface PendingParticipationRequest {
  id: number
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
}

interface PendingFollowRequest {
  followId: number
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `relative px-3.5 py-1.5 text-[13px] font-semibold tracking-wide rounded-lg transition-all duration-200 ${
    isActive
      ? 'bg-white/[0.08] text-white'
      : 'text-white/70 hover:text-white hover:bg-white/[0.05]'
  }`

const canSeeFinance = (role?: string) =>
  role === 'superadmin' || role === 'admin' || role === 'blagajnik'

export default function AppLayout() {
  const { t } = useTranslation('appLayout')
  const { t: tCommon } = useTranslation('common')
  const { logout, user, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isSuperadminNoClub =
    user?.role === 'superadmin' && !localStorage.getItem('superadmin_club_id')
  const hasClubContext = userHasClubContext(user)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notifications, setNotifications] = useState<ObavestenjeItem[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingActionRequestsCount, setPendingActionRequestsCount] = useState(0)
  const [pendingFollowRequestsCount, setPendingFollowRequestsCount] = useState(0)
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

  useEffect(() => {
    if (!isLoggedIn || isSuperadminNoClub) return
    api.get('/api/obavestenja/unread-count').then((r) => setUnreadCount(r.data.unreadCount ?? 0)).catch(() => {})
  }, [isLoggedIn, isSuperadminNoClub])

  useEffect(() => {
    if (!isLoggedIn || isSuperadminNoClub) return
    const loadRequestCounts = async () => {
      try {
        const [actionRes, followRes] = await Promise.all([
          api.get<{ requests: PendingParticipationRequest[] }>('/api/moja-ucesca-zahtevi', { params: { status: 'pending' } }),
          api.get<{ requests: PendingFollowRequest[] }>('/api/follows/requests/pending'),
        ])
        setPendingActionRequestsCount((actionRes.data.requests || []).filter((req) => req.status === 'pending').length)
        setPendingFollowRequestsCount((followRes.data.requests || []).length)
      } catch {
        setPendingActionRequestsCount(0)
        setPendingFollowRequestsCount(0)
      }
    }
    void loadRequestCounts()
  }, [isLoggedIn, isSuperadminNoClub, isNotificationsOpen, location.pathname])

  useEffect(() => {
    if (!isLoggedIn || isSuperadminNoClub || !isNotificationsOpen) return
    setNotificationsLoading(true)
    setUnreadCount(0)
    api
      .patch('/api/obavestenja/read-all')
      .then(() => api.get('/api/obavestenja', { params: { limit: 20 } }))
      .then((r) => setNotifications(r.data.obavestenja ?? []))
      .catch(() => setNotifications([]))
      .finally(() => setNotificationsLoading(false))
  }, [isLoggedIn, isSuperadminNoClub, isNotificationsOpen])

  useEffect(() => {
    pullDistanceRef.current = pullDistance
  }, [pullDistance])

  // Global mobile pull-to-refresh (all protected screens)
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
      api.patch(`/api/obavestenja/${n.id}/read`).then(() => setUnreadCount((c) => Math.max(0, c - 1))).catch(() => {})
    }
    setIsNotificationsOpen(false)
    // Akcije: direktno na detalj akcije; ostalo na stranicu obaveštenja sa učitanim entitetom
    if (n.type === 'akcija' && n.link?.trim()) {
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

  // Superadmin bez izabranog kluba može da vidi samo /superadmin (posle svih hook-ova)
  if (isSuperadminNoClub && location.pathname !== '/superadmin') {
    return <Navigate to="/superadmin" replace />
  }

  const iconBtnClass =
    'inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition-all duration-200'
  const totalPendingRequests = pendingActionRequestsCount + pendingFollowRequestsCount
  const hasPendingRequests = totalPendingRequests > 0
  const requestsSummaryMobileClass = hasPendingRequests
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700'

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
              {/* Logo */}
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

                {/* Desktop nav – sakriven za superadmina bez kluba */}
                {!isSuperadminNoClub && (
                <nav className="hidden md:flex items-center gap-1">
                  <NavLink to="/home" className={navLinkClass}>{t('home')}</NavLink>
                  <NavLink to="/akcije" className={navLinkClass}>{t('actions')}</NavLink>
                  {hasClubContext && <NavLink to="/zadaci" className={navLinkClass}>{t('tasks')}</NavLink>}
                  {hasClubContext && <NavLink to="/users" className={navLinkClass}>{t('members')}</NavLink>}
                  <NavLink to="/klub" className={navLinkClass}>{t('club')}</NavLink>
                  {canSeeFinance(user?.role) && (
                    <NavLink to="/finansije" className={navLinkClass}>{t('finances')}</NavLink>
                  )}
                  {user?.role === 'superadmin' && (
                    <NavLink to="/superadmin" className={navLinkClass}>{t('clubs')}</NavLink>
                  )}
                </nav>
                )}
                {isSuperadminNoClub && (
                  <span className="hidden sm:block text-sm text-white/70">{t('chooseClub')}</span>
                )}
                {/* Superadmin sa izabranim klubom: prikaz "Ušao u: [naziv]" + Promeni klub */}
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

              {/* Right section */}
              <div className="flex items-center gap-2">
                {/* Desktop actions – Search i Notifications sakriveni za superadmina bez kluba */}
                <div className="hidden md:flex md:items-center md:gap-1.5">
                  {!isSuperadminNoClub && (
                  <>
                  {/* Search */}
                  <button
                    ref={searchButtonRef}
                    type="button"
                    onClick={() => {
                      setIsNotificationsOpen(false)
                      setIsProfileMenuOpen(false)
                      setIsSearchOpen((v) => !v)
                    }}
                    className={iconBtnClass}
                    aria-label={t('search')}
                  >
                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.5 4.5a6 6 0 014.615 9.847l3.769 3.768-1.414 1.415-3.768-3.769A6 6 0 1110.5 4.5z" />
                    </svg>
                  </button>

                  {/* Notifications */}
                  <div ref={notificationsBlockRef} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(false)
                        setIsProfileMenuOpen(false)
                        setIsNotificationsOpen((v) => !v)
                      }}
                      className={`relative ${iconBtnClass} ${hasPendingRequests ? 'ring-2 ring-amber-300/60 bg-amber-500/15 text-amber-100 hover:text-amber-50 hover:bg-amber-500/25' : ''}`}
                      aria-label={t('notifications')}
                    >
                      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m1 0v1a2 2 0 104 0v-1m-4 0h4" />
                      </svg>
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-emerald-500">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>

                    {isNotificationsOpen && (
                      <div className="absolute right-0 top-12 w-80 rounded-2xl bg-white py-2 shadow-2xl ring-1 ring-black/5 z-40 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-100">
                          <p className="text-xs font-semibold text-gray-800">{t('notifications')}</p>
                          <LanguageSwitcher />
                        </div>
                        <div className="px-4 pt-2">
                          <button
                            type="button"
                            onClick={() => { navigate('/obavestenja'); setIsNotificationsOpen(false) }}
                            className={`w-full rounded-xl border px-3 py-2 text-left text-[11px] font-semibold transition-colors ${requestsSummaryMobileClass}`}
                          >
                            <p className="uppercase tracking-wider">Trenutni zahtevi</p>
                            {hasPendingRequests ? (
                              <p className="mt-1 normal-case">Trenutno imate: {totalPendingRequests} zahteva</p>
                            ) : (
                              <p className="mt-1 normal-case">Nemate zahteva</p>
                            )}
                          </button>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notificationsLoading ? (
                            <p className="px-4 py-4 text-xs text-gray-500">{t('loading')}</p>
                          ) : notifications.length === 0 ? (
                            <p className="px-4 py-4 text-xs text-gray-500">{t('noNotifications')}</p>
                          ) : (
                            notifications.map((n) => {
                              return (
                                <button
                                  key={n.id}
                                  type="button"
                                  onClick={() => handleNotificationClick(n)}
                                  className={`flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${!n.readAt ? 'bg-emerald-50/40' : ''}`}
                                >
                                  <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${obavestenjeBellIconClass(n.type)}`}>
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
                        <div className="mt-1 border-t border-gray-100 px-4 pt-2 pb-1.5 flex items-center justify-between">
                          <button
                            type="button"
                                  onClick={() => { navigate('/obavestenja'); setIsNotificationsOpen(false) }}
                            className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                          >
                            {t('showAllNotifications')}
                          </button>
                          <button
                            type="button"
                            className="text-[11px] text-gray-400 hover:text-gray-600"
                            onClick={() => setIsNotificationsOpen(false)}
                          >
                            {t('close')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  </>
                  )}

                  {/* Divider – sakriven kada nema search/notifications */}
                  {!isSuperadminNoClub && (
                  <div className="h-6 w-px bg-white/10 mx-1.5" />
                  )}

                  {/* Profile dropdown */}
                  {user && (
                    <div ref={profileBlockRef} className="relative flex items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setIsSearchOpen(false)
                          setIsNotificationsOpen(false)
                          setIsProfileMenuOpen((v) => !v)
                        }}
                        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/[0.06] transition-all duration-200 group"
                      >
                        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white shadow-sm overflow-hidden ring-2 ring-white/10 group-hover:ring-emerald-400/30 transition-all">
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.fullName || user.username}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>
                              {(user.fullName || user.username || '?').charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="text-left hidden lg:block">
                          <p className="text-xs font-semibold text-white/90 leading-tight">
                            {user.fullName || user.username}
                          </p>
                          <p className="text-[10px] text-white/50 leading-tight">
                            @{user.username}
                          </p>
                        </div>
                        <svg className="hidden lg:block h-3.5 w-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                      {isProfileMenuOpen && (
                        <div className="absolute right-0 top-12 w-52 rounded-2xl bg-white py-1.5 shadow-2xl ring-1 ring-black/5 z-50">
                          <div className="px-3.5 py-2.5 border-b border-gray-100">
                            <p className="text-sm font-semibold text-gray-900 truncate">{user.fullName || user.username}</p>
                            <p className="text-[11px] text-gray-400 truncate">@{user.username}</p>
                          </div>
                          <div className="py-1">
                            <button
                              type="button"
                              onClick={() => {
                                setIsProfileMenuOpen(false)
                                navigate(`/korisnik/${user.username}`)
                              }}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                              </svg>
                              {t('myProfile')}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setIsProfileMenuOpen(false); navigate('/profil/podesavanja') }}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {t('settings')}
                            </button>
                          </div>
                          <div className="border-t border-gray-100 pt-1">
                            <button
                              type="button"
                              onClick={() => { setIsProfileMenuOpen(false); handleLogout() }}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                              </svg>
                              {t('logout')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Mobile hamburger */}
                <div className="md:hidden flex items-center">
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/[0.08] focus:outline-none transition-all"
                    aria-expanded={isMenuOpen}
                    aria-label={isMenuOpen ? t('closeMenu') : t('openMenu')}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                {hasClubContext && (
                  <NavLink
                    to="/zadaci"
                    className={({ isActive }) =>
                      `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                        isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                      }`
                    }
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t('tasks')}
                  </NavLink>
                )}
                {hasClubContext && (
                  <NavLink
                    to="/users"
                    className={({ isActive }) =>
                      `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                        isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                      }`
                    }
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t('members')}
                  </NavLink>
                )}
                <NavLink
                  to="/klub"
                  className={({ isActive }) =>
                    `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                      isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                    }`
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t('club')}
                </NavLink>
                {canSeeFinance(user?.role) && (
                  <NavLink
                    to="/finansije"
                    className={({ isActive }) =>
                      `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                        isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                      }`
                    }
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t('finances')}
                  </NavLink>
                )}
                {user?.role === 'superadmin' && (
                  <NavLink
                    to="/superadmin"
                    className={({ isActive }) =>
                      `rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                        isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                      }`
                    }
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t('clubs')}
                  </NavLink>
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

      {/* Mobile bottom bar sakriven za superadmina bez kluba */}
      {isLoggedIn && !isSuperadminNoClub && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white backdrop-blur-xl md:hidden">
          <div className="mx-auto flex max-w-7xl items-center px-2 py-2">
            <div className="flex-1 flex justify-center">
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="flex flex-col items-center justify-center gap-0.5"
                aria-label={t('home')}
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white shadow-sm">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
                    />
                  </svg>
                </span>

              </button>
            </div>

            <div className="flex-1 flex justify-center">
              <button
                ref={mobileNotificationsButtonRef}
                type="button"
                onClick={() => {
                  setIsSearchOpen(false)
                  setIsProfileMenuOpen(false)
                  setIsNotificationsOpen((v) => !v)
                }}
                className="relative flex flex-col items-center justify-center"
                aria-label={t('notifications')}
              >
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm ${
                  hasPendingRequests ? 'bg-amber-500/30 ring-2 ring-amber-300/60' : 'bg-white/20'
                }`}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m1 0v1a2 2 0 104 0v-1m-4 0h4" />
                  </svg>
                </span>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-1/4 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-emerald-500">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </div>

            <div className="flex-1 flex justify-center">
              <button
                type="button"
                onClick={() => navigate('/search')}
                className="flex flex-col items-center justify-center"
                aria-label={t('search')}
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white shadow-sm">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
              </button>
            </div>

            <div className="flex-1 flex justify-center">
              <button
                type="button"
                onClick={() => navigate(user ? `/korisnik/${user.username}` : '/profil')}
                className="flex flex-col items-center justify-center"
                aria-label={t('profile')}
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 ring-2 ring-white/30 text-white overflow-hidden shadow-sm">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.fullName || user.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-semibold text-sm">
                      {(user?.fullName || user?.username || '?').charAt(0).toUpperCase()}
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
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-hidden
            onClick={() => setIsNotificationsOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">{t('notifications')}</p>
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(false)}
                className="p-2 -m-2 rounded-full text-gray-500 hover:bg-gray-100"
                aria-label={t('close')}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-4 pt-3">
              <button
                type="button"
                onClick={() => { navigate('/obavestenja'); setIsNotificationsOpen(false) }}
                className={`w-full rounded-xl border px-3 py-2.5 text-left text-xs font-semibold ${requestsSummaryMobileClass}`}
              >
                <p className="uppercase tracking-wider">Trenutni zahtevi</p>
                {hasPendingRequests ? (
                  <p className="mt-1 normal-case">Trenutno imate: {totalPendingRequests} zahteva</p>
                ) : (
                  <p className="mt-1 normal-case">Nemate zahteva</p>
                )}
              </button>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              {notificationsLoading ? (
                <p className="px-4 py-6 text-sm text-gray-500">{t('loading')}</p>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-500">{t('noNotifications')}</p>
              ) : (
                <div className="py-1">
                  {notifications.map((n) => {
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 ${!n.readAt ? 'bg-emerald-50/40' : ''}`}
                      >
                        <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${obavestenjeBellIconClass(n.type)}`}>
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
                onClick={() => { navigate('/obavestenja'); setIsNotificationsOpen(false) }}
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
              >
                {t('showAllNotifications')}
              </button>
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
