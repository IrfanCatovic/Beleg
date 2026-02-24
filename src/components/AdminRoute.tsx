
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminRoute() {
  const { user } = useAuth()

  if (!user || user.role !== 'admin') {
    return <Navigate to="/home" replace />
  }

  return <Outlet />
}