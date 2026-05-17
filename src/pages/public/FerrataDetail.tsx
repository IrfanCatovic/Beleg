import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { FerrataDetailMapCard } from '../../components/ferrate/FerrataDetailMapCard'
import { FerrataDetailGallery } from '../../components/ferrate/FerrataDetailGallery'
import { FerrataHotelsSection } from '../../components/ferrate/FerrataHotelsSection'
import { FerrataGuidesSection } from '../../components/ferrate/FerrataGuidesSection'
import { FerrataEquipmentGlyph, suggestEquipmentIcon } from '../../components/ferrate/ferrataEquipmentIcons'
import { PlaninerIcon, type PlaninerIconName } from '../../components/ui/PlaninerIcon'
import { CalendarDaysIcon, PhotoIcon, PlusIcon, StarIcon } from '@heroicons/react/24/outline'

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

  const hasAbout = Boolean(f?.opis?.trim())
  const hasWhy = Boolean(f?.highlights?.length)

  const createActionHref =
    user && ['superadmin', 'admin', 'vodic'].includes(user.role) && f
      ? `/dodaj-akciju?tip=via_ferrata&ferrata_id=${f.id}`
      : '/login'

  return (
    <div className="pb-20">
      {loading && <p className="px-4 text-sm text-gray-500">…</p>}
      {err && <p className="px-4 text-sm text-rose-600">{err}</p>}

      {f && (
        <>
          {/* Hero: puna širina ekrana + uz nav bar (uklanja prazan prostor od main pt-6) */}
          <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 -mt-6 overflow-x-hidden">
            <div className="relative z-0">
              <section className="relative min-h-[280px] sm:min-h-[380px] lg:min-h-[460px]">
                {coverUrl ? (
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${coverUrl})` }} />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/75" aria-hidden />
                  </>
                )}

                {/* Desktop: ime + lokacija gore desno (ne prekriva levi/centralni deo slike) */}
                <div className="pointer-events-none absolute inset-0 z-10 hidden lg:block">
                  <div className="mx-auto flex h-full min-h-[280px] max-w-6xl px-4 sm:min-h-[380px] sm:px-6 lg:min-h-[460px] lg:px-8">
                    <div className="relative min-h-[280px] flex-1 sm:min-h-[380px] lg:min-h-[460px]">
                    <div
                      className={`pointer-events-auto absolute right-0 top-6 max-w-[min(22rem,calc(100%-1rem))] rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md sm:right-0 sm:top-8 sm:max-w-sm lg:top-10 ${
                        coverUrl
                          ? 'border-emerald-100/90 bg-white/95 text-gray-900'
                          : 'border-white/20 bg-slate-950/75 text-white'
                      }`}
                    >
                      <h1 className={`text-xl font-extrabold tracking-tight sm:text-2xl ${coverUrl ? 'text-gray-900' : 'text-white'}`}>
                        {f.naziv}
                      </h1>
                      {regionSubtitle && (
                        <p className={`mt-1.5 text-sm leading-snug ${coverUrl ? 'text-gray-600' : 'text-white/85'}`}>{regionSubtitle}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Mobilni: ime odmah ispod slike, pa stat kartice koje malo uđu u cover */}
            <div className="relative z-20 bg-white px-4 pb-1 pt-3 sm:px-6 lg:hidden">
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">{f.naziv}</h1>
              {regionSubtitle && <p className="mt-2 max-w-3xl text-sm text-gray-600 sm:text-base">{regionSubtitle}</p>}
            </div>

            <div className="relative z-20 mt-0 px-4 sm:px-6 lg:-mt-[4.5rem] lg:px-8">
              <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 lg:grid-cols-5">
                {(
                  [
                    { label: t('statsDifficulty'), value: f.tezina, icon: 'difficulty' as const },
                    { label: t('statsHarderOption'), value: f.tezinaOpcija || '—', icon: 'harder' as const },
                    { label: t('statsLength'), value: `${f.duzinaM} m`, icon: 'distance' as const },
                    { label: t('statsElevation'), value: `${f.visinskaRazlikaM} m`, icon: 'height' as const },
                    {
                      label: t('statsDuration'),
                      value: t('cardDuration', {
                        min: Math.round(f.trajanjeMin),
                        max: Math.round(f.trajanjeMax),
                      }),
                      icon: 'time' as const,
                    },
                  ] satisfies ReadonlyArray<{ label: string; value: string; icon: PlaninerIconName }>
                ).map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-gray-100 bg-white/98 px-4 py-3 shadow-md shadow-emerald-900/10 backdrop-blur-sm flex flex-col gap-1 ring-1 ring-black/[0.03]"
                  >
                    <PlaninerIcon name={card.icon} variant="small" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{card.label}</p>
                    <p className="text-sm font-bold text-gray-900">{card.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="relative z-20 px-4 pb-2 pt-1 text-xs text-gray-600 sm:px-6 lg:hidden">{t('heroNote')}</p>
          </div>
          </div>

          <div className="-mx-4 sm:-mx-6 lg:-mx-8">
          {Boolean(f.galerija?.some((u) => u?.trim())) && (
            <div className="mt-10 px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-6xl">
                <FerrataDetailGallery naziv={f.naziv} urls={f.galerija!.filter((u) => u?.trim())} />
              </div>
            </div>
          )}

          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mt-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,340px)] lg:items-start">
              <div className="space-y-6">
                {hasAbout && (
                  <article className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 sm:p-6">
                    <div className="mb-2 flex items-center gap-3">
                      <PlaninerIcon name="about" variant="solid" />
                      <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700">{t('aboutTitle')}</h2>
                    </div>
                    <p className="text-sm sm:text-base text-gray-700 whitespace-pre-line leading-relaxed">{f.opis!.trim()}</p>
                  </article>
                )}

                {hasWhy && (
                  <article className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 sm:p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <PlaninerIcon name="why" variant="solid" />
                      <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700">{t('whyTitle')}</h2>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {f.highlights!.map((h) => (
                        <div key={h} className="flex gap-3 rounded-xl border border-gray-50 bg-emerald-50/40 p-3">
                          <PlaninerIcon name="why" variant="small" className="mt-0.5" />
                          <p className="text-sm font-medium text-gray-800">{h}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                )}

                {(() => {
                  const opremaItems = normalizeOprema(f.obaveznaOprema).filter((it) => it.label?.trim())
                  if (!opremaItems.length) return null
                  return (
                    <article className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 sm:p-6">
                      <div className="mb-4 flex items-center gap-3">
                        <PlaninerIcon name="gear" variant="solid" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700">{t('equipmentTitle')}</h2>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {opremaItems.map((item) => {
                          const raw = item.icon?.trim() ? item.icon.trim() : suggestEquipmentIcon(item.label)
                          const iconKey = raw === 'TruckIcon' ? 'HandRaisedIcon' : raw
                          return (
                            <span
                              key={`${item.label}-${item.icon ?? ''}`}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800"
                            >
                              <FerrataEquipmentGlyph name={iconKey} className="h-4 w-4 shrink-0 text-emerald-600" />
                              {item.label.trim()}
                            </span>
                          )
                        })}
                      </div>
                    </article>
                  )
                })()}

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

                {Boolean(f.okolina?.some((x) => x?.trim())) && (
                  <article className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 sm:p-6">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700 mb-4">{t('detailOkolinaTitle')}</h2>
                    <ul className="space-y-2 text-sm text-gray-800">
                      {f.okolina!.filter((x) => x?.trim()).map((line, idx) => (
                        <li key={`okolina-${idx}`} className="flex gap-2">
                          <span className="font-bold text-emerald-600">·</span>
                          <span>{line.trim()}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                )}
              </div>

              <aside className="space-y-5">
                <div className="flex flex-col space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-900">{t('sidebarPlanTitle')}</h3>
                  <p className="text-xs text-gray-500">{t('sidebarPlanHint')}</p>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                    {t('statusAvailable')}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link
                      to={createActionHref}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm"
                    >
                      <PlusIcon className="h-4 w-4" />
                      {t('heroCtaCreate')}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setBookOpen(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 px-4 py-2.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50/80"
                    >
                      <CalendarDaysIcon className="h-4 w-4" />
                      {t('heroCtaBook')}
                    </button>
                    {user?.role === 'superadmin' && (
                      <Link
                        to={`/superadmin/ferrate/${String(f.id)}/galerija`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-900 transition hover:bg-violet-100"
                      >
                        <PhotoIcon className="h-4 w-4" />
                        {t('detailSuperadminGalleryCta')}
                      </Link>
                    )}
                  </div>
                  <p className="hidden text-xs leading-relaxed text-gray-600 pt-1 lg:block">{t('heroNote')}</p>
                </div>

                {hasMapCoords && (
                  <FerrataGuidesSection
                    ferrataLat={f.lat as number}
                    ferrataLng={f.lng as number}
                    tourType="via_ferrata"
                  />
                )}

                {hasMapCoords && (
                  <FerrataHotelsSection variant="sidebar" ferrataLat={f.lat as number} ferrataLng={f.lng as number} />
                )}

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-3">
                    <PlaninerIcon name="actions" variant="solid" />
                    <h3 className="text-sm font-bold text-gray-900">{t('sidebarUpcomingTitle')}</h3>
                  </div>
                  {upcoming.length === 0 ? (
                    <p className="text-xs text-gray-600">{t('sidebarUpcomingEmpty')}</p>
                  ) : (
                    <ul className="space-y-3">
                      {upcoming.map((a) => {
                        const d = new Date(a.startAt)
                        const day = d.toLocaleDateString('sr-Latn', { day: '2-digit', month: 'short' }).toUpperCase()
                        const spots = a.maxLjudi > 0 ? Math.max(0, a.maxLjudi - Number(a.prijavljeno || 0)) : '—'
                        return (
                          <li key={a.id} className="flex gap-3 border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                            <div className="w-12 shrink-0 rounded-lg border border-emerald-100 bg-emerald-50 py-1 text-center">
                              <span className="block text-[10px] font-bold leading-tight text-emerald-800">{day}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-xs font-bold text-gray-900">{a.naziv}</p>
                              {a.klubNaziv && <p className="mt-0.5 text-[11px] text-gray-500">{a.klubNaziv}</p>}
                              <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                                {typeof spots === 'number' ? t('sidebarUpcomingSpots', { n: spots }) : spots}
                              </p>
                              <button
                                type="button"
                                onClick={() => navigate(`/akcije/${a.id}`)}
                                className="mt-1 text-[11px] font-semibold text-emerald-700 hover:underline"
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
                  <div className="flex gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-5">
                    <StarIcon className="h-6 w-6 shrink-0 text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-bold text-emerald-900">{t('sidebarRecTitle')}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-emerald-900/80 whitespace-pre-line">{f.quickTip.trim()}</p>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
          </div>
        </>
      )}

      <FerrataBookModal open={bookOpen} onClose={() => setBookOpen(false)} contacts={contacts} />
    </div>
  )
}
