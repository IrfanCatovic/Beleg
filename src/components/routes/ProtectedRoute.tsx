import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute() {
  const { isLoggedIn, authLoading, user } = useAuth()
  const location = useLocation()

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ returnTo: `${location.pathname}${location.search}` }} />
  }

  const onProfileSettingsRoute = location.pathname.startsWith('/profil/podesavanja')
  if (user?.profileIncomplete && !onProfileSettingsRoute) {
    return <Navigate to="/profil/podesavanja" replace state={{ returnTo: location.pathname }} />
  }

  return <Outlet />
}