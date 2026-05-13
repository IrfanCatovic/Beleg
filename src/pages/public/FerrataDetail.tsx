import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { FerrataDetailMapCard } from '../../components/ferrate/FerrataDetailMapCard'
import { FerrataDetailGallery } from '../../components/ferrate/FerrataDetailGallery'
import { FerrataSmestajSection, type SmestajPublic } from '../../components/ferrate/FerrataSmestajSection'
import { FerrataEquipmentGlyph, suggestEquipmentIcon } from '../../components/ferrate/ferrataEquipmentIcons'
import {
  BoltIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  MapPinIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
} from '@heroicons/react/24/outline'

type OpremaItem = { label: string; icon?: string }

type FerrataDTO = {
  id: number
  slug: string
  naziv: string
  drzava?: string
  gradOpstina?: string
  podrucje?: string
  opis: string
  tezina: string
  tezinaOpcija: string
  duzinaM: number
  visinskaRazlikaM: number
  trajanjeMin: number
  trajanjeMax: number
  quickTip?: string
  highlights: string[]
  okolina?: string[]
  smestaj?: SmestajPublic[]
  obaveznaOprema: OpremaItem[] | string[]
  coverImage: string
  /** Galerija ispod heroa (pored cover slike). */
  galerija?: string[]
  /** Uputstvo / putanja do starta (prikaz ispod mape). */
  mapNote?: string
  lat?: number | null
  lng?: number | null
}

type ContactRow = {
  id: number
  ime: string
  telefon?: string
  whatsapp?: string
  email?: string
  napomena?: string
}

type UpcomingRow = {
  id: number
  naziv: string
  startAt: string
  klubNaziv?: string
  maxLjudi: number
  prijavljeno: number
}

function formatHoursRange(min: number, max: number) {
  const a = (min / 60).toFixed(1).replace(/\.0$/, '')
  const b = (max / 60).toFixed(1).replace(/\.0$/, '')
  return `${a}–${b}`
}

function normalizeOprema(raw: FerrataDTO['obaveznaOprema']): OpremaItem[] {
  if (!raw?.length) return []
  if (typeof raw[0] === 'string') return (raw as string[]).map((label) => ({ label }))
  return raw as OpremaItem[]
}

function FerrataBookModal(props: {
  open: boolean
  onClose: () => void
  contacts: ContactRow[]
}) {
  const { t } = useTranslation('ferrate')
  if (!props.open) return null
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose()
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{t('modalBookTitle')}</h2>
          <button type="button" onClick={props.onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-800">
            {t('modalClose')}
          </button>
        </div>
        <div className="p-4 space-y-4">
          {props.contacts.length === 0 ? (
            <p className="text-sm text-gray-600">{t('modalBookEmpty')}</p>
          ) : (
            props.contacts.map((c) => (
              <div key={c.id} className="rounded-xl border border-gray-100 p-3 space-y-1.5">
                <p className="font-semibold text-gray-900">{c.ime}</p>
                {c.telefon && <p className="text-sm text-gray-700">{c.telefon}</p>}
                {c.whatsapp && (
                  <a
                    href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    {t('whatsApp')}
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="block text-sm text-emerald-700 font-medium">
                    {c.email}
                  </a>
                )}
                {c.napomena && <p className="text-xs text-gray-500">{c.napomena}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default function FerrataDetail() {
  const { slug } = useParams<{ slug: string }>()
  const { t } = useTranslation('ferrate')
  const navigate = useNavigate()
  const { user } = useAuth()
  const [f, setF] = useState<FerrataDTO | null>(null)
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [bookOpen, setBookOpen] = useState(false)

  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    setErr('')
    try {
      const res = await api.get(`/api/ferratas/slug/${encodeURIComponent(slug)}`)
      const ferrata = res.data?.ferrata as FerrataDTO
      setF(ferrata || null)
      if (ferrata?.id) {
        const [cRes, uRes] = await Promise.all([
          api.get(`/api/ferratas/${ferrata.id}/contacts`),
          api.get(`/api/ferratas/${ferrata.id}/upcoming-actions`),
        ])
        setContacts(cRes.data?.contacts ?? [])
        setUpcoming(uRes.data?.akcije ?? [])
      }
    } catch {
      setErr('Greška pri učitavanju.')
      setF(null)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  const coverUrl = (f?.coverImage ?? '').trim()
  const regionSubtitle =
    f?.podrucje?.trim() || [f?.gradOpstina, f?.drzava].filter((x) => x && String(x).trim()).join(', ')
  const hasMapCoords =
    f != null && f.lat != null && f.lng != null && Number.isFinite(f.lat) && Number.isFinite(f.lng)

  const createActionHref =
    user && ['superadmin', 'admin', 'vodic'].includes(user.role) && f
      ? `/dodaj-akciju?tip=via_ferrata&ferrata_id=${f.id}`
      : '/login'

  return (
    <div className="pb-20 -mx-4 sm:-mx-6 lg:-mx-8">
      {loading && <p className="px-4 text-sm text-gray-500">…</p>}
      {err && <p className="px-4 text-sm text-rose-600">{err}</p>}

      {f && (
        <>
          {/* Hero — uz cover sliku bez zatamnjenja; tekst u svetlom panelu radi čitljivosti */}
          <section className="relative flex min-h-[320px] flex-col justify-end sm:min-h-[420px]">
            {coverUrl ? (
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${coverUrl})` }} />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950" />
            )}
            {!coverUrl && (
              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/75" aria-hidden />
            )}
            <div className="relative z-10 max-w-5xl px-4 pb-10 pt-16 sm:px-8 lg:px-12">
              <div
                className={
                  coverUrl
                    ? 'rounded-2xl border border-emerald-100/80 bg-white/92 px-5 py-6 shadow-lg shadow-emerald-900/5 backdrop-blur-sm sm:px-6'
                    : ''
                }
              >
                <h1
                  className={`text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl ${
                    coverUrl ? 'text-gray-900' : 'text-white drop-shadow-lg'
                  }`}
                >
                  {f.naziv}
                </h1>
                {regionSubtitle && (
                  <p className={`mt-2 max-w-3xl text-sm sm:text-base ${coverUrl ? 'text-gray-600' : 'text-white/90'}`}>
                    {regionSubtitle}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                      coverUrl
                        ? 'border-emerald-200/90 bg-emerald-50/90 text-emerald-900'
                        : 'border-white/20 bg-white/15 text-white backdrop-blur-md'
                    }`}
                  >
                    <ChartBarIcon className="h-3.5 w-3.5" />
                    {f.tezina}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                      coverUrl
                        ? 'border-gray-200/90 bg-white/90 text-gray-800'
                        : 'border-white/20 bg-white/15 text-white backdrop-blur-md'
                    }`}
                  >
                    <MapPinIcon className="h-3.5 w-3.5" />
                    {f.duzinaM} m
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                      coverUrl
                        ? 'border-gray-200/90 bg-white/90 text-gray-800'
                        : 'border-white/20 bg-white/15 text-white backdrop-blur-md'
                    }`}
                  >
                    <ClockIcon className="h-3.5 w-3.5" />
                    {formatHoursRange(f.trajanjeMin, f.trajanjeMax)} h
                  </span>
                </div>
                <div className="mt-6 flex flex-col flex-wrap gap-3 sm:flex-row">
                  <Link
                    to={createActionHref}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:from-emerald-400 hover:to-teal-500"
                  >
                    <PlusIcon className="h-5 w-5" />
                    {t('heroCtaCreate')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setBookOpen(true)}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition ${
                      coverUrl
                        ? 'border-emerald-200 bg-white text-emerald-900 shadow-sm hover:bg-emerald-50/80'
                        : 'border-white/40 bg-black/30 text-white backdrop-blur-md hover:bg-black/45'
                    }`}
                  >
                    <CalendarDaysIcon className="h-5 w-5" />
                    {t('heroCtaBook')}
                  </button>
                </div>
                <p className={`mt-4 max-w-xl text-xs sm:text-sm ${coverUrl ? 'text-gray-600' : 'text-white/75'}`}>
                  {t('heroNote')}
                </p>
              </div>
            </div>
          </section>

          {/* Quick stats */}
          <div className="px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 max-w-6xl mx-auto">
              {[
                { label: t('statsDifficulty'), value: f.tezina, icon: ChartBarIcon },
                { label: t('statsHarderOption'), value: f.tezinaOpcija || '—', icon: BoltIcon },
                { label: t('statsLength'), value: `${f.duzinaM} m`, icon: MapPinIcon },
                { label: t('statsElevation'), value: `${f.visinskaRazlikaM} m`, icon: SparklesIcon },
                { label: t('statsDuration'), value: `${formatHoursRange(f.trajanjeMin, f.trajanjeMax)} h`, icon: ClockIcon },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3 flex flex-col gap-1"
                >
                  <card.icon className="h-5 w-5 text-emerald-600" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{card.label}</p>
                  <p className="text-sm font-bold text-gray-900">{card.value}</p>
                </div>
              ))}
            </div>
          </div>

          {Boolean(f.galerija?.some((u) => u?.trim())) && (
            <div className="mt-10 px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-6xl">
                <FerrataDetailGallery naziv={f.naziv} urls={f.galerija!.filter((u) => u?.trim())} />
              </div>
            </div>
          )}

          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mt-10 lg:grid lg:grid-cols-[1fr_340px] lg:gap-8 lg:items-start">
            {/* Main column */}
            <div className="space-y-6">
              {hasMapCoords && (
                <FerrataDetailMapCard
                  key={f.slug}
                  lat={f.lat as number}
                  lng={f.lng as number}
                  naziv={f.naziv}
                  subtitle={regionSubtitle}
                  routeNote={f.mapNote}
                />
              )}

              {f.opis?.trim() && (
                <article className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 sm:p-6">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700 mb-2">{t('aboutTitle')}</h2>
                  <p className="text-sm sm:text-base text-gray-700 whitespace-pre-line leading-relaxed">{f.opis.trim()}</p>
                </article>
              )}

              {f.highlights?.length > 0 && (
                <article className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 sm:p-6">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700 mb-4">{t('whyTitle')}</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {f.highlights.map((h) => (
                      <div key={h} className="flex gap-3 rounded-xl border border-gray-50 bg-emerald-50/40 p-3">
                        <SparklesIcon className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                        <p className="text-sm text-gray-800 font-medium">{h}</p>
                      </div>
                    ))}
                  </div>
                </article>
              )}

              {Boolean(f.okolina?.some((x) => x?.trim())) && (
                <article className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 sm:p-6">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700 mb-4">{t('detailOkolinaTitle')}</h2>
                  <ul className="space-y-2 text-sm text-gray-800">
                    {f.okolina!.filter((x) => x?.trim()).map((line, idx) => (
                      <li key={`okolina-${idx}`} className="flex gap-2">
                        <span className="text-emerald-600 font-bold">·</span>
                        <span>{line.trim()}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              )}

              {f.smestaj && f.smestaj.length > 0 && <FerrataSmestajSection items={f.smestaj} />}

              {(() => {
                const opremaItems = normalizeOprema(f.obaveznaOprema).filter((it) => it.label?.trim())
                if (!opremaItems.length) return null
                return (
                  <article className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 sm:p-6">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700 mb-4">{t('equipmentTitle')}</h2>
                    <div className="flex flex-wrap gap-2">
                      {opremaItems.map((item) => {
                        const iconKey = item.icon?.trim() ? item.icon.trim() : suggestEquipmentIcon(item.label)
                        return (
                          <span
                            key={`${item.label}-${item.icon ?? ''}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800"
                          >
                            <FerrataEquipmentGlyph name={iconKey} className="h-4 w-4 text-emerald-600 shrink-0" />
                            {item.label.trim()}
                          </span>
                        )
                      })}
                    </div>
                  </article>
                )
              })()}

              {contacts.length > 0 && (
                <article className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 sm:p-6">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700 mb-4">{t('detailGuidesTitle')}</h2>
                  <ul className="space-y-4">
                    {contacts.map((c) => (
                      <li key={c.id} className="rounded-xl border border-gray-50 bg-gray-50/60 p-4 space-y-2">
                        <p className="font-semibold text-gray-900">{c.ime}</p>
                        {c.telefon && <p className="text-sm text-gray-700">{c.telefon}</p>}
                        {c.whatsapp && (
                          <a
                            href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-semibold text-emerald-700 hover:underline"
                          >
                            {t('whatsApp')}
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="text-sm font-semibold text-emerald-700 hover:underline break-all">
                            {c.email}
                          </a>
                        )}
                        {c.napomena?.trim() && <p className="text-xs text-gray-600 whitespace-pre-line">{c.napomena.trim()}</p>}
                      </li>
                    ))}
                  </ul>
                </article>
              )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-5 mt-8 lg:mt-0">
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-900">{t('sidebarPlanTitle')}</h3>
                <p className="text-xs text-gray-500">{t('sidebarPlanHint')}</p>
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800">
                  {t('statusAvailable')}
                </div>
                <div className="flex flex-col gap-2">
                  <Link
                    to={createActionHref}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold px-4 py-2.5 shadow-sm"
                  >
                    <PlusIcon className="h-4 w-4" />
                    {t('heroCtaCreate')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setBookOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 text-emerald-800 text-sm font-bold px-4 py-2.5 hover:bg-emerald-50/80"
                  >
                    <CalendarDaysIcon className="h-4 w-4" />
                    {t('heroCtaBook')}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3">{t('sidebarUpcomingTitle')}</h3>
                {upcoming.length === 0 ? (
                  <p className="text-xs text-gray-600">{t('sidebarUpcomingEmpty')}</p>
                ) : (
                  <ul className="space-y-3">
                    {upcoming.map((a) => {
                      const d = new Date(a.startAt)
                      const day = d.toLocaleDateString('sr-Latn', { day: '2-digit', month: 'short' }).toUpperCase()
                      const spots = a.maxLjudi > 0 ? Math.max(0, a.maxLjudi - Number(a.prijavljeno || 0)) : '—'
                      return (
                        <li key={a.id} className="flex gap-3 border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                          <div className="shrink-0 w-12 text-center rounded-lg bg-emerald-50 border border-emerald-100 py-1">
                            <span className="block text-[10px] font-bold text-emerald-800 leading-tight">{day}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-gray-900 line-clamp-2">{a.naziv}</p>
                            {a.klubNaziv && <p className="text-[11px] text-gray-500 mt-0.5">{a.klubNaziv}</p>}
                            <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                              {typeof spots === 'number' ? t('sidebarUpcomingSpots', { n: spots }) : spots}
                            </p>
                            <button
                              type="button"
                              onClick={() => navigate(`/akcije/${a.id}`)}
                              className="text-[11px] font-semibold text-emerald-700 hover:underline mt-1"
                            >
                              {t('sidebarViewActions')} →
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <Link to="/akcije" className="mt-3 inline-block text-xs font-semibold text-emerald-700 hover:underline">
                  {t('sidebarViewActions')} →
                </Link>
              </div>

              {f.quickTip?.trim() && (
                <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 p-5 flex gap-3">
                  <StarIcon className="h-6 w-6 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-emerald-900">{t('sidebarRecTitle')}</h3>
                    <p className="text-xs text-emerald-900/80 mt-1 leading-relaxed whitespace-pre-line">{f.quickTip.trim()}</p>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </>
      )}

      <FerrataBookModal open={bookOpen} onClose={() => setBookOpen(false)} contacts={contacts} />
    </div>
  )
}
