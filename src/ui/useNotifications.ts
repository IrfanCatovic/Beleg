import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  fetchObavestenja,
  fetchFollowRequestsPending,
  fetchPendingParticipationRequests,
  fetchUnreadCount,
  markAllObavestenjaRead,
} from '../services/obavestenja'
import type { ObavestenjeItem } from '../types/obavestenje'

export function useNotifications(isLoggedIn: boolean, isSuperadminNoClub: boolean) {
  const location = useLocation()

  const [notifications, setNotifications] = useState<ObavestenjeItem[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingActionRequestsCount, setPendingActionRequestsCount] = useState(0)
  const [pendingFollowRequestsCount, setPendingFollowRequestsCount] = useState(0)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  useEffect(() => {
    if (!isLoggedIn || isSuperadminNoClub) return
    void fetchUnreadCount().then(setUnreadCount).catch(() => {})
  }, [isLoggedIn, isSuperadminNoClub])

  useEffect(() => {
    if (!isLoggedIn || isSuperadminNoClub) return
    const loadRequestCounts = async () => {
      try {
        const [actionReqs, followReqs] = await Promise.all([
          fetchPendingParticipationRequests(),
          fetchFollowRequestsPending(),
        ])
        setPendingActionRequestsCount(actionReqs.filter((req) => req.status === 'pending').length)
        setPendingFollowRequestsCount(followReqs.length)
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
    void markAllObavestenjaRead()
      .then(() => fetchObavestenja(20))
      .then(setNotifications)
      .catch(() => setNotifications([]))
      .finally(() => setNotificationsLoading(false))
  }, [isLoggedIn, isSuperadminNoClub, isNotificationsOpen])

  const totalPendingRequests = pendingActionRequestsCount + pendingFollowRequestsCount
  const hasPendingRequests = totalPendingRequests > 0

  return {
    notifications,
    notificationsLoading,
    unreadCount,
    setUnreadCount,
    pendingActionRequestsCount,
    pendingFollowRequestsCount,
    totalPendingRequests,
    hasPendingRequests,
    isNotificationsOpen,
    setIsNotificationsOpen,
  }
}

export type NotificationsState = ReturnType<typeof useNotifications>
