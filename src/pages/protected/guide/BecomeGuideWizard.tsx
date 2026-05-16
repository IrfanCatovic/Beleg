import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  GuideApplicationWizard,
  emptyGuideWizardForm,
  guideProfileToForm,
} from '../../../components/guides/GuideApplicationWizard'
import {
  applyGuideProfile,
  getMyGuideProfile,
  updateMyGuideProfile,
  type GuideApplyPayload,
  type GuideProfile,
} from '../../../services/guideProfiles'
import { useAuth } from '../../../context/AuthContext'

export default function BecomeGuideWizard() {
  const { t } = useTranslation('guideProfiles')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<GuideProfile | null | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const gp = await getMyGuideProfile()
      setProfile(gp)
    } catch {
      setProfile(null)
      setError(t('errors.load'))
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSubmit(payload: GuideApplyPayload) {
    setLoading(true)
    setError('')
    try {
      if (profile?.status === 'rejected') {
        await updateMyGuideProfile(payload)
      } else {
        await applyGuideProfile(payload)
      }
      navigate(user?.username ? `/korisnik/${user.username}` : '/home')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string }; status?: number } }
      if (err.response?.status === 409) {
        setError(t('errors.alreadyExists'))
      } else {
        setError(err.response?.data?.error || t('errors.submit'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (profile === undefined) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-sm text-gray-500">
        {t('errors.load')}
      </div>
    )
  }

  const canEdit = !profile || profile.status === 'rejected'
  const mode = profile?.status === 'rejected' ? 'edit' : 'create'

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-10">
      <Link
        to={user?.username ? `/korisnik/${user.username}` : '/home'}
        className="text-sm font-medium text-emerald-700 hover:text-emerald-800 mb-4 inline-block"
      >
        {t('backToProfile')}
      </Link>
      <div className="mb-6">
        <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
          {t('badge')}
        </span>
        <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">{t('title')}</h1>
      </div>

      {profile?.status === 'pending' && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-bold text-amber-900">{t('status.pendingTitle')}</h2>
            <p className="mt-1 text-sm text-amber-800">{t('status.pendingBody')}</p>
        </div>
      )}

      {profile?.status === 'approved' && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="font-bold text-emerald-900">{t('status.approvedTitle')}</h2>
          <p className="mt-1 text-sm text-emerald-800">{t('status.approvedBody')}</p>
        </div>
      )}

      {profile?.status === 'suspended' && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <h2 className="font-bold text-gray-900">{t('status.suspendedTitle')}</h2>
          <p className="mt-1 text-sm text-gray-600">{t('status.suspendedBody')}</p>
        </div>
      )}

      {profile?.status === 'rejected' && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <h2 className="font-bold text-rose-900">{t('status.rejectedTitle')}</h2>
          {profile.razlogOdbijanja && (
            <p className="mt-2 text-sm text-rose-800 whitespace-pre-wrap">{profile.razlogOdbijanja}</p>
          )}
        </div>
      )}

      {canEdit && (
        <GuideApplicationWizard
          mode={mode}
          initialForm={profile ? guideProfileToForm(profile) : emptyGuideWizardForm()}
          loading={loading}
          error={error}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}
