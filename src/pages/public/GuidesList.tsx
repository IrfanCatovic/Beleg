import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserGroupIcon } from '@heroicons/react/24/outline'
import { GuideCatalogCard } from '../../components/guides/GuideCatalogCard'
import {
  listGuidesCatalog,
  type GuideCatalogCategory,
  type GuideNearbyPublic,
} from '../../services/guidesPublic'
import { guideDisplayName } from '../../components/ferrate/GuideNearbyCard'

const FILTERS: { key: GuideCatalogCategory; labelKey: 'filterAll' | 'filterFerrata' | 'filterMountains' }[] = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'ferrata', labelKey: 'filterFerrata' },
  { key: 'planine', labelKey: 'filterMountains' },
]

export default function GuidesList() {
  const { t } = useTranslation('guideProfiles')
  const [category, setCategory] = useState<GuideCatalogCategory>('all')
  const [rows, setRows] = useState<GuideNearbyPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await listGuidesCatalog({ category, limit: 100 })
      setRows(list)
    } catch {
      setError(t('catalog.loadError'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [category, t])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  const visible = useMemo(
    () => rows.filter((g) => guideDisplayName(g) !== '—'),
    [rows],
  )

  return (
    <div className="min-h-[60vh] bg-gradient-to-b from-emerald-50/40 to-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <UserGroupIcon className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                {t('catalog.title')}
              </h1>
              <p className="mt-1 text-sm text-gray-600 sm:text-base">{t('catalog.subtitle')}</p>
            </div>
          </div>

          <div
            className="mt-6 inline-flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
            role="tablist"
            aria-label={t('catalog.title')}
          >
            {FILTERS.map((f) => {
              const active = category === f.key
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(f.key)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {t(`catalog.${f.labelKey}`)}
                </button>
              )
            })}
          </div>
        </header>

        {loading && (
          <p className="text-sm text-gray-500" aria-live="polite">
            …
          </p>
        )}

        {error && !loading && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        )}

        {!loading && !error && visible.length === 0 && (
          <p className="rounded-xl border border-gray-100 bg-white px-4 py-8 text-center text-sm text-gray-500 shadow-sm">
            {t('catalog.empty')}
          </p>
        )}

        {!loading && !error && visible.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((g) => (
              <li key={g.id} className="min-w-0 list-none">
                <GuideCatalogCard guide={g} tGuide={t} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
