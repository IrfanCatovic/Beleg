import { Navigate, Outlet } from 'react-router-dom'

export default function ProtectedRoute() {
    //I will use this for now until JWT token
  const isAuthenticated = !!localStorage.getItem('isLoggedIn')


  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}