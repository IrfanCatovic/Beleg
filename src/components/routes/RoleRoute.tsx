import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

interface RoleRouteProps {
  allowedRoles: string[]
}

export default function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const { user } = useAuth()
//check if user is logged in and if user role is in allowedRoles
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/home" replace />
  }

  return <Outlet />
}
