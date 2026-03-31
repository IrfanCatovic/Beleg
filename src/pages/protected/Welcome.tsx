import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import Loader from '../../components/Loader'
import { useTranslation } from 'react-i18next'

export default function Welcome() {
  const { t } = useTranslation('miscPages')
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
  const checkSetup = async () => {
    try {
      const res = await api.get('/api/setup/status')

      const setupCompleted = res.data.hasUsers || res.data.setupCompleted || false;
      if (setupCompleted) {
        navigate('/navrhu', { replace: true })
      }
    } catch (err) {
      console.error(t('welcome.setupCheckErrorLog'), err)
        }
        finally {
          setLoading(false)
        }
      }

      checkSetup()
    }, [navigate])

  if (loading) {
    return <Loader />
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-50 px-4 py-12">

      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,#41ac53_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,#fed74c_0%,transparent_60%)]" />
      </div>

      {/* Glavni sadržaj */}
      <div className="relative z-10 max-w-3xl text-center">
        <h1 
          className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-6 md:mb-8 leading-tight"
          style={{ color: '#41ac53' }}
        >
          planiner
        </h1>

        <p className="text-xl sm:text-2xl md:text-3xl font-light text-gray-700 mb-6 md:mb-10 leading-relaxed">
            {t('welcome.heroLine')}
        </p>

        <p className="text-lg sm:text-xl text-gray-600 mb-12 md:mb-16 max-w-2xl mx-auto leading-relaxed">
          {t('welcome.body1')}
          <br className="hidden sm:block" />
          {t('welcome.body2')}
        </p>

        <Link
          to="/adminregister"
          className="inline-block px-12 py-5 text-xl sm:text-2xl font-bold text-white rounded-full shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-3xl focus:outline-none focus:ring-4 focus:ring-emerald-400/50"
          style={{ background: 'linear-gradient(135deg, #41ac53 0%, #2e8b45 100%)' }}
        >
          {t('welcome.start')}
        </Link>

        <p className="mt-16 text-sm text-gray-500">
          {t('welcome.footer', { year: new Date().getFullYear() })}
        </p>
      </div>
    </div>
  )
}