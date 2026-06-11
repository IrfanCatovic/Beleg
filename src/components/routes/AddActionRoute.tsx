import { useEffect, useState } from 'react'
import { Navigate, Outlet, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isApprovedProfiGuide } from '../../services/guideProfiles'
import Loader from '../Loader'

const CLUB_ACTION_ROLES = ['superadmin', 'admin', 'vodic'] as const

function isGuideFerrataFlow(searchParams: URLSearchParams): boolean {
  if (searchParams.get('tip') !== 'via_ferrata') return false
  if (searchParams.get('booking_id')) return true
  return searchParams.get('organizator') === 'vodic'
}

export default function AddActionRoute() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [access, setAccess] = useState<'loading' | 'allowed' | 'denied'>('loading')

  useEffect(() => {
    if (!user) {
      setAccess('denied')
      return
    }

    if (CLUB_ACTION_ROLES.includes(user.role as (typeof CLUB_ACTION_ROLES)[number])) {
      setAccess('allowed')
      return
    }

    if (!isGuideFerrataFlow(searchParams)) {
      setAccess('denied')
      return
    }

    let cancelled = false
    void isApprovedProfiGuide()
      .then((ok) => {
        if (!cancelled) setAccess(ok ? 'allowed' : 'denied')
      })
      .catch(() => {
        if (!cancelled) setAccess('denied')
      })

    return () => {
      cancelled = true
    }
  }, [user, searchParams])

  if (!user) return <Navigate to="/login" replace />
  if (access === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader />
      </div>
    )
  }
  if (access === 'denied') return <Navigate to="/home" replace />

  return <Outlet />
}
