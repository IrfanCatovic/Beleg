import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface RoleRouteProps {
  allowedRoles: string[]
}

/** Dozvoljava pristup samo korisnicima čija je rola u allowedRoles (npr. admin uvek vidi sve). */
export default function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const { user } = useAuth()

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/home" replace />
  }

  return <Outlet />
}
