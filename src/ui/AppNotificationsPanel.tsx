import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { formatRelativeTime } from '../utils/dateUtils'
import { obavestenjeBellIconClass } from '../utils/obavestenjeIconClass'
import { markObavestenjeRead } from '../services/obavestenja'
import type { ObavestenjeItem } from '../types/obavestenje'
import { iconBtnClass } from './appLayoutStyles'

export interface AppNotificationsPanelProps {
  open: boolean
  loading: boolean
  notifications: ObavestenjeItem[]
  unreadCount: number
  hasPendingRequests: boolean
  totalPendingRequests: number
  requestsSummaryClass: string
  onToggle: () => void
  onClose: () => void
  onUnreadCountChange: (fn: (c: number) => number) => void
  panelRef?: React.RefObject<HTMLDivElement | null>
  variant: 'desktop' | 'mobile-overlay'
}

export function AppNotificationsBellButton({
  open,
  unreadCount,
  hasPendingRequests,
  onToggle,
  buttonRef,
}: {
  open: boolean
  unreadCount: number
  hasPendingRequests: boolean
  onToggle: () => void
  buttonRef?: React.RefObject<HTMLButtonElement | null>
}) {
  const { t } = useTranslation('appLayout')
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      className={`relative ${iconBtnClass} ${hasPendingRequests ? 'ring-2 ring-amber-300/60 bg-amber-500/15 text-amber-100 hover:text-amber-50 hover:bg-amber-500/25' : ''}`}
      aria-label={t('notifications')}
      aria-expanded={open}
    >
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m1 0v1a2 2 0 104 0v-1m-4 0h4"
        />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-emerald-500">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}

export function AppNotificationsPanel({
  open,
  loading,
  notifications,
  hasPendingRequests,
  totalPendingRequests,
  requestsSummaryClass,
  onClose,
  onUnreadCountChange,
  panelRef,
  variant,
}: Omit<AppNotificationsPanelProps, 'onToggle' | 'unreadCount'>) {
  const { t } = useTranslation('appLayout')
  const navigate = useNavigate()

  if (!open) return null

  const handleNotificationClick = (n: ObavestenjeItem) => {
    if (!n.readAt) {
      void markObavestenjeRead(n.id).then(() => onUnreadCountChange((c) => Math.max(0, c - 1)))
    }
    onClose()
    if ((n.type === 'akcija' || n.type === 'summit_reward') && n.link?.trim()) {
      navigate(n.link.trim())
      return
    }
    navigate(`/obavestenja/${n.id}`)
  }

  const panelClass =
    variant === 'desktop'
      ? 'absolute right-0 top-12 w-80 rounded-2xl bg-white py-2 shadow-2xl ring-1 ring-black/5 z-40 animate-in fade-in slide-in-from-top-2 duration-200'
      : 'fixed inset-x-4 top-20 z-50 max-h-[70vh] overflow-hidden rounded-2xl bg-white py-2 shadow-2xl ring-1 ring-black/10'

  return (
    <div ref={panelRef} className={panelClass}>
      <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-800">{t('notifications')}</p>
        {variant === 'desktop' && <LanguageSwitcher />}
      </div>
      <div className="px-4 pt-2">
        <button
          type="button"
          onClick={() => {
            navigate('/obavestenja')
            onClose()
          }}
          className={`w-full rounded-xl border px-3 py-2 text-left text-[11px] font-semibold transition-colors ${requestsSummaryClass}`}
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
        {loading ? (
          <p className="px-4 py-4 text-xs text-gray-500">{t('loading')}</p>
        ) : notifications.length === 0 ? (
          <p className="px-4 py-4 text-xs text-gray-500">{t('noNotifications')}</p>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleNotificationClick(n)}
              className={`flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${!n.readAt ? 'bg-emerald-50/40' : ''}`}
            >
              <span
                className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${obavestenjeBellIconClass(n.type)}`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m1 0v1a2 2 0 104 0v-1m-4 0h4"
                  />
                </svg>
              </span>
              <span className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{n.title}</p>
                {n.body && <p className="mt-0.5 text-[11px] text-gray-500 line-clamp-2">{n.body}</p>}
                <p className="mt-0.5 text-[11px] text-gray-400">{formatRelativeTime(n.createdAt)}</p>
              </span>
            </button>
          ))
        )}
      </div>
      <div className="mt-1 border-t border-gray-100 px-4 pt-2 pb-1.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            navigate('/obavestenja')
            onClose()
          }}
          className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
        >
          {t('showAllNotifications')}
        </button>
        <button type="button" className="text-[11px] text-gray-400 hover:text-gray-600" onClick={onClose}>
          {t('close')}
        </button>
      </div>
    </div>
  )
}
