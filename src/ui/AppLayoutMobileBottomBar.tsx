import { useNavigate } from 'react-router-dom'
import type { TFunction } from 'i18next'
import type { User } from '../context/AuthContext'
import type { ObavestenjeItem } from '../types/obavestenje'
import { formatRelativeTime } from '../utils/dateUtils'
import { obavestenjeBellIconClass } from '../utils/obavestenjeIconClass'

export interface AppLayoutMobileBottomBarProps {
  user: User | null
  unreadCount: number
  hasPendingRequests: boolean
  totalPendingRequests: number
  isNotificationsOpen: boolean
  setIsNotificationsOpen: React.Dispatch<React.SetStateAction<boolean>>
  setIsSearchOpen: React.Dispatch<React.SetStateAction<boolean>>
  setIsProfileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  mobileNotificationsButtonRef: React.RefObject<HTMLButtonElement | null>
  mobileNotificationsPanelRef: React.RefObject<HTMLDivElement | null>
  notificationsLoading: boolean
  notifications: ObavestenjeItem[]
  requestsSummaryMobileClass: string
  onNotificationClick: (n: ObavestenjeItem) => void
  t: TFunction
}

export function AppLayoutMobileBottomBar({
  user,
  unreadCount,
  hasPendingRequests,
  totalPendingRequests,
  isNotificationsOpen,
  setIsNotificationsOpen,
  setIsSearchOpen,
  setIsProfileMenuOpen,
  mobileNotificationsButtonRef,
  mobileNotificationsPanelRef,
  notificationsLoading,
  notifications,
  requestsSummaryMobileClass,
  onNotificationClick,
  t,
}: AppLayoutMobileBottomBarProps) {
  const navigate = useNavigate()
  const handleNotificationClick = onNotificationClick
  return (
    <>
      {/* Mobile bottom bar sakriven za superadmina bez kluba */}
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

      {/* Mobile notifications overlay */}
      {isNotificationsOpen && (
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
    </>
  )
}
