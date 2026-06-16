import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { InlineLoader } from '../../components/Loader'

export default function ProtectedRoute() {
  const { isLoggedIn, authLoading, user } = useAuth()
  const location = useLocation()

  if (authLoading) {
    return <InlineLoader />
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