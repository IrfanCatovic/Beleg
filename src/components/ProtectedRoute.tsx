import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
    //I will use this for now until JWT token
  const { isLoggedIn } = useAuth()


  if (!isLoggedIn) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}