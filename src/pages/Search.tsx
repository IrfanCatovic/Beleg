import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Search() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/', { replace: true })
    }
  }, [isLoggedIn, navigate])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Pretraga</h1>
      <p className="text-gray-600 max-w-md">
        Ovde ćemo dodati naprednu pretragu akcija, članova i drugih podataka. Za sada je ovo samo
        priprema za budući chat i search funkcionalnosti.
      </p>
    </div>
  )
}

