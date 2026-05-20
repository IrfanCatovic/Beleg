import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listGuidesNearby, type GuideNearbyPublic } from '../../services/guidesPublic'
import { PlaninerIcon } from '../ui/PlaninerIcon'
import { ferrataDetailCardClass } from './ferrataDetailCardStyles'
import { GuideNearbyCard, guideDisplayName } from './GuideNearbyCard'

export function FerrataGuidesSection(props: {
  ferrataLat: number
  ferrataLng: number
  tourType?: string
}) {
  const { t } = useTranslation('ferrate')
  const { t: tGuide } = useTranslation('guideProfiles')
  const [rows, setRows] = useState<GuideNearbyPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const list = await listGuidesNearby({
          lat: props.ferrataLat,
          lng: props.ferrataLng,
          radiusKm: 100,
          limit: 30,
          tourType: props.tourType,
        })
        if (!cancelled) setRows(list)
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [props.ferrataLat, props.ferrataLng, props.tourType])

  useEffect(() => {
    setExpanded(false)
  }, [props.ferrataLat, props.ferrataLng, props.tourType])

  const list = useMemo(
    () =>
      rows.filter((g) => {
        const pin = g.baseLat != null && g.baseLng != null && Number.isFinite(g.baseLat) && Number.isFinite(g.baseLng)
        return pin && guideDisplayName(g) !== '—'
      }),
    [rows],
  )

  const visibleList = expanded ? list : list.slice(0, 2)

  return (
    <article className={`min-w-0 max-w-full ${ferrataDetailCardClass}`}>
      <div className="mb-4 flex items-center gap-3">
        <PlaninerIcon name="guide" variant="solid" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700">{t('detailLocalGuidesTitle')}</h2>
      </div>
      {loading && <p className="text-sm text-gray-500">…</p>}
      {!loading && list.length === 0 && <p className="text-sm text-gray-500">{t('detailGuidesEmpty')}</p>}
      {!loading && list.length > 0 && (
        <>
          <ul className="grid min-w-0 gap-3">
            {visibleList.map((g) => (
              <GuideNearbyCard key={g.id} guide={g} t={t} tGuide={tGuide} />
            ))}
          </ul>
          {list.length > 2 && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50/80 py-2.5 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100/90"
            >
              {expanded ? t('detailGuidesShowLess') : t('detailGuidesShowAll')}
            </button>
          )}
        </>
      )}
    </article>
  )
}
