import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { FerrataGalleryEditor } from '../../components/ferrate/FerrataGalleryEditor'

type FerrataApi = {
  id: number
  naziv: string
  slug: string
  galerija?: unknown
}

function galerijaFromApi(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x).trim()).filter(Boolean)
}

export default function SuperadminFerrataGallery() {
  const { ferrataId } = useParams<{ ferrataId: string }>()
  const { t } = useTranslation('ferrate')
  const { user } = useAuth()
  const id = ferrataId ? parseInt(ferrataId, 10) : NaN
  const [ferrata, setFerrata] = useState<FerrataApi | null>(null)
  const [urls, setUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) return
    setLoading(true)
    setErr('')
    try {
      const res = await api.get<{ ferrata: FerrataApi }>(`/api/superadmin/ferratas/${id}`)
      const f = res.data?.ferrata
      setFerrata(f ?? null)
      setUrls(f ? galerijaFromApi(f.galerija) : [])
    } catch {
      setErr('Greška pri učitavanju.')
      setFerrata(null)
      setUrls([])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function persistGallery(next: string[]) {
    setErr('')
    try {
      await api.patch(`/api/superadmin/ferratas/${id}/galerija`, { galerija: next })
      setUrls(next)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(msg || 'Čuvanje galerije nije uspelo.')
      await load()
    }
  }

  if (!user || user.role !== 'superadmin') {
    return <p className="p-6 text-sm text-gray-600">Nemate pristup.</p>
  }

  if (!Number.isFinite(id)) {
    return <p className="p-6 text-sm text-gray-600">Nevažeća ferata.</p>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('superadminGalleryManageTitle')}</h1>
          {ferrata && <p className="text-sm text-gray-600 mt-1">{ferrata.naziv}</p>}
          <p className="text-xs text-gray-500 mt-2 max-w-xl leading-relaxed">{t('superadminGalleryPageIntro')}</p>
        </div>
        <Link to="/superadmin/ferrate" className="text-sm font-semibold text-emerald-700 hover:underline">
          {t('superadminGalleryManageBack')}
        </Link>
      </div>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      {loading && <p className="text-sm text-gray-500">…</p>}
      {!loading && ferrata && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
          <p className="text-xs font-bold text-gray-800 mb-3">{t('superadminGalleryTitle')}</p>
          <FerrataGalleryEditor
            urls={urls}
            onChange={(next) => void persistGallery(next)}
            ferrataId={id}
            onUploadError={(msg) => setErr(msg)}
          />
          <p className="text-[10px] text-gray-500 mt-3">{t('superadminGalleryManageHint')}</p>
        </div>
      )}
      {!loading && !ferrata && err && (
        <p className="text-sm text-gray-600">
          <Link to="/superadmin/ferrate" className="font-semibold text-emerald-700 hover:underline">
            {t('superadminGalleryManageBack')}
          </Link>
        </p>
      )}
    </div>
  )
}
