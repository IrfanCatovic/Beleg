import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import GlobalSearchPanel from '../../components/GlobalSearchPanel'

export default function Search() {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qFromUrl = searchParams.get('q') ?? ''
  const [searchQuery, setSearchQuery] = useState(qFromUrl)

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/', { replace: true })
    }
  }, [isLoggedIn, navigate])

  useEffect(() => {
    setSearchQuery(qFromUrl)
  }, [qFromUrl])

  if (!isLoggedIn) return null

  return (
    <div className="min-h-[60vh]">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Pretraga</h1>
        <p className="text-gray-600 text-sm sm:text-base mb-6">
          Pretražite članove, akcije i finansije. Rezultati se prikazuju u tabovima.
        </p>
        <GlobalSearchPanel
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onClose={() => {}}
          canSeeFinances={user?.role === 'admin' || user?.role === 'blagajnik' || false}
          embedded={false}
          showDetailButton={false}
        />
      </div>
    </div>
  )
}
