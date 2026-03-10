import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import Loader from '../../components/Loader'

export default function RegisterSuperAdmin() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await api.get('/api/setup/status')
        if (!res.data.needsSuperadmin) {
          // Ako više ne treba superadmin, zabranjuj pristup ovoj stranici
          navigate('/login', { replace: true })
          return
        }
      } catch (err) {
        console.error(err)
        setError('Greška pri proveri statusa.')
      } finally {
        setChecking(false)
      }
    }
    checkStatus()
  }, [navigate])

  if (checking) {
    return <Loader />
  }


  return (
    <div>...tvoja forma za superadmina...</div>
  )
}