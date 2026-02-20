import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function Finance() {
  const { user } = useAuth()

  if (!user || user.role !== 'admin') {
    return <Navigate to="/home" replace /> 
  }
  return (
    <div>
      <h1>Finance Page</h1>
    </div>
  )
}