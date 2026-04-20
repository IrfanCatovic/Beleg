import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { userHasClubContext } from '../../utils/clubContext'

/** Zadaci i slično — samo za korisnike sa kontekstom kluba (član ili superadmin). */
export default function ClubScopedRoute() {
  const { user } = useAuth()
  if (!userHasClubContext(user)) {
    return <Navigate to="/home" replace />
  }
  return <Outlet />
}
