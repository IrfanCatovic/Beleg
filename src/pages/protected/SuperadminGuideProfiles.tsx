import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Marker } from 'react-map-gl/maplibre'
import { useAuth } from '../../context/AuthContext'
import {
  approveGuideProfile,
  listGuideProfilesAdmin,
  rejectGuideProfile,
  suspendGuideProfile,
  type GuideProfile,
} from '../../services/guideProfiles'
import { PlaninerMapFrame } from '../../map/components/PlaninerMapFrame'
import { formatDateShort } from '../../utils/dateUtils'

export default function SuperadminGuideProfiles() {
  const { t } = useTranslation('guideProfiles')
  const { user } = useAuth()
  const [rows, setRows] = useState<GuideProfile[]>([])
  const [filter, setFilter] = useState<'all' | 'pending'>('all')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [detail, setDetail] = useState<GuideProfile | null>(null)
  const [rejectTarget, setRejectTarget] = useState<GuideProfile | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const list = await listGuideProfilesAdmin(filter === 'pending' ? 'pending' : undefined)
      setRows(list)
    } catch {
      setErr(t('superadmin.loadError'))
    } finally {
      setLoading(false)
    }
  }, [filter, t])

  useEffect(() => {
    void load()
  }, [load])

  if (!user || user.role !== 'superadmin') {
    return <p className="p-6 text-sm text-gray-600">{t('superadmin.noAccess')}</p>
  }

  const statusLabel = (s: string) => {
    if (s === 'pending') return t('superadmin.statusPending')
    if (s === 'approved') return t('superadmin.statusApproved')
    if (s === 'rejected') return t('superadmin.statusRejected')
    if (s === 'suspended') return t('superadmin.statusSuspended')
    return s
  }

  async function runApprove(id: number) {
    setActing(true)
    try {
      await approveGuideProfile(id)
      await load()
      setDetail(null)
    } catch {
      setErr(t('superadmin.actionError'))
    } finally {
      setActing(false)
    }
  }

  async function runReject() {
    if (!rejectTarget || !rejectReason.trim()) return
    setActing(true)
    try {
      await rejectGuideProfile(rejectTarget.id, rejectReason.trim())
      setRejectTarget(null)
      setRejectReason('')
      await load()
      setDetail(null)
    } catch {
      setErr(t('superadmin.actionError'))
    } finally {
      setActing(false)
    }
  }

  async function runSuspend(id: number) {
    setActing(true)
    try {
      await suspendGuideProfile(id)
      await load()
      setDetail(null)
    } catch {
      setErr(t('superadmin.actionError'))
    } finally {
      setActing(false)
    }
  }

  const locationLabel = (gp: GuideProfile) =>
    [gp.grad, gp.region, gp.drzava].filter(Boolean).join(', ') || '—'

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link to="/superadmin" className="text-sm text-emerald-700 font-medium hover:underline">
        {t('superadmin.back')}
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-gray-900">{t('superadmin.title')}</h1>

      <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              filter === 'all' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {t('superadmin.filterAll')}
          </button>
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              filter === 'pending' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {t('superadmin.filterPending')}
          </button>
        </div>

      {err && <p className="mt-4 text-sm text-rose-600">{err}</p>}

      {loading ? (
        <p className="mt-8 text-sm text-gray-500">{t('superadmin.loadError')}</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-gray-500">{t('superadmin.empty')}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">{t('superadmin.tableUser')}</th>
                <th className="px-4 py-3">{t('superadmin.tableOpis')}</th>
                <th className="px-4 py-3">{t('superadmin.tableLocation')}</th>
                <th className="px-4 py-3">{t('superadmin.tableStatus')}</th>
                <th className="px-4 py-3">{t('superadmin.tableDate')}</th>
                <th className="px-4 py-3">{t('superadmin.tableActions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((gp) => (
                <tr key={gp.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{gp.user?.fullName || gp.user?.username}</div>
                    <div className="text-xs text-gray-500">@{gp.user?.username}</div>
                  </td>
                  <td className="px-4 py-3 max-w-[240px] truncate text-gray-600" title={gp.opis}>
                    {gp.opis}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{locationLabel(gp)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-semibold">
                      {statusLabel(gp.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDateShort(gp.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold hover:bg-gray-50"
                        onClick={() => setDetail(gp)}
                      >
                        {t('superadmin.detail')}
                      </button>
                      {gp.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={acting}
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            onClick={() => void runApprove(gp.id)}
                          >
                            {t('superadmin.approve')}
                          </button>
                          <button
                            type="button"
                            disabled={acting}
                            className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                            onClick={() => {
                              setRejectTarget(gp)
                              setRejectReason('')
                            }}
                          >
                            {t('superadmin.reject')}
                          </button>
                        </>
                      )}
                      {gp.status === 'approved' && (
                        <button
                          type="button"
                          disabled={acting}
                          className="rounded-lg bg-slate-700 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          onClick={() => void runSuspend(gp.id)}
                        >
                          {t('superadmin.suspend')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex justify-between items-start gap-2 mb-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900">
                  {detail.user?.fullName || detail.user?.username || '—'}
                </h2>
                {detail.user?.username && (
                  <p className="text-sm text-gray-500">@{detail.user.username}</p>
                )}
              </div>
              <button
                type="button"
                className="shrink-0 text-sm text-gray-500 hover:text-gray-800"
                onClick={() => setDetail(null)}
              >
                {t('superadmin.close')}
              </button>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap mb-4">{detail.opis}</p>
            <p className="text-xs text-gray-500 mb-1">
              {t('step1.jezici')}: {(detail.jezici || []).join(', ')}
            </p>
            {detail.sertifikatiOpis && (
              <p className="text-xs text-gray-500 mb-1">{detail.sertifikatiOpis}</p>
            )}
            <p className="text-xs text-gray-500 mb-4">
              {t('step3.tourTypes')}:{' '}
              {(detail.tourTypes || []).map((k) => t(`tourTypes.${k}`)).join(', ')}
            </p>
            {detail.baseLat != null && detail.baseLng != null && (
              <div className="h-48 rounded-xl overflow-hidden border border-gray-200">
                <PlaninerMapFrame
                  className="h-full w-full"
                  initialViewState={{
                    longitude: detail.baseLng,
                    latitude: detail.baseLat,
                    zoom: 11,
                  }}
                >
                  <Marker longitude={detail.baseLng} latitude={detail.baseLat} anchor="bottom">
                    <div className="h-6 w-6 rounded-full border-2 border-white bg-emerald-500 shadow" />
                  </Marker>
                </PlaninerMapFrame>
              </div>
            )}
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">{t('superadmin.rejectModalTitle')}</h2>
            <label className="mt-3 block text-xs font-semibold uppercase text-gray-500">
              {t('superadmin.rejectReason')}
            </label>
            <textarea
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm min-h-[100px]"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('superadmin.rejectReasonPlaceholder')}
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold"
                onClick={() => setRejectTarget(null)}
              >
                {t('superadmin.cancel')}
              </button>
              <button
                type="button"
                disabled={acting || !rejectReason.trim()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void runReject()}
              >
                {t('superadmin.confirmReject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
