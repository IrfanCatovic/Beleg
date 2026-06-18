import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchMeProfile } from '../../services/auth'
import { useAuth } from '../../context/AuthContext'
import { listGuidesNearby, listGuidesCatalog, type GuideNearbyPublic } from '../../services/guidesPublic'
import { createPeakGuideBooking } from '../../services/peakGuideBookings'
import { GuideNearbyCard, guideDisplayName } from '../ferrate/GuideNearbyCard'
import { FerrataGuideBookingHotelsStep } from '../ferrate/FerrataGuideBookingHotelsStep'
import {
  emptyGuideBookingForm,
  type FerrataGuideBookingFormState,
  type GuideBookingEquipmentStatus,
  type GuideBookingGroupExperience,
  type GuideBookingTimeOfDay,
} from '../ferrate/ferrataGuideBookingTypes'

const baseInput =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 outline-none transition'
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-[0.16em]'

type WizardStep = 1 | 2 | 3

function ChipOption(props: {
  name: string
  value: string
  checked: boolean
  label: string
  onChange: (value: string) => void
}) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition ${
        props.checked
          ? 'border-emerald-400 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-400/40'
          : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-200 hover:bg-emerald-50/40'
      }`}
    >
      <input
        type="radio"
        name={props.name}
        value={props.value}
        checked={props.checked}
        onChange={() => props.onChange(props.value)}
        className="sr-only"
      />
      {props.label}
    </label>
  )
}

function Fieldset(props: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className={labelClass}>{props.title}</legend>
      {props.children}
    </fieldset>
  )
}

const PEAK_HOTELS_HASH = '#peak-hoteli'

export function PeakGuideBookingModal(props: {
  open: boolean
  onClose: () => void
  peakId: number
  peakName: string
  peakMountain: string
  peakLocation: string
  peakHeightM?: number
  peakLat: number
  peakLng: number
}) {
  const { t } = useTranslation('peaks')
  const { t: tShared } = useTranslation('ferrate')
  const { t: tGuide } = useTranslation('guideProfiles')
  const navigate = useNavigate()
  const { user } = useAuth()

  const [step, setStep] = useState<WizardStep>(1)
  const [form, setForm] = useState<FerrataGuideBookingFormState>(emptyGuideBookingForm)
  const [localErr, setLocalErr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [guides, setGuides] = useState<GuideNearbyPublic[]>([])
  const [guidesFromCatalog, setGuidesFromCatalog] = useState(false)
  const [guidesLoading, setGuidesLoading] = useState(false)
  const [guideSearch, setGuideSearch] = useState('')
  const [selectedGuideIds, setSelectedGuideIds] = useState<Set<number>>(new Set())

  const filterValidGuides = (list: GuideNearbyPublic[], requireLocationPin = true) =>
    list.filter((g) => {
      if (guideDisplayName(g) === '—') return false
      if (!requireLocationPin) return true
      const pin = g.baseLat != null && g.baseLng != null && Number.isFinite(g.baseLat) && Number.isFinite(g.baseLng)
      return pin
    })

  const guideMatchesSearch = (g: GuideNearbyPublic, query: string): boolean => {
    const haystack = [
      guideDisplayName(g),
      g.naslov,
      g.grad,
      g.region,
      g.drzava,
      g.user?.username,
      g.user?.fullName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  }

  const filteredGuides = useMemo(() => {
    const q = guideSearch.trim().toLowerCase()
    if (!q) return guides
    return guides.filter((g) => guideMatchesSearch(g, q))
  }, [guides, guideSearch])

  const hasMapCoords = Number.isFinite(props.peakLat) && Number.isFinite(props.peakLng)

  useEffect(() => {
    if (!props.open) return
    setStep(1)
    setForm(emptyGuideBookingForm())
    setLocalErr('')
    setSubmitting(false)
    setSelectedGuideIds(new Set())
    setGuideSearch('')
    setGuidesFromCatalog(false)
    if (!user) return
    void fetchMeProfile()
      .then((data) => {
        const tel = (data as { telefon?: string } | null)?.telefon?.trim()
        if (tel) setForm((f) => ({ ...f, contactPhone: tel }))
      })
      .catch(() => {})
  }, [props.open, user])

  useEffect(() => {
    if (!props.open || step !== 2 || !hasMapCoords) return
    let cancelled = false
    setGuidesLoading(true)
    setGuidesFromCatalog(false)
    setGuideSearch('')

    const loadGuides = async () => {
      try {
        const nearby = filterValidGuides(
          await listGuidesNearby({
            lat: props.peakLat,
            lng: props.peakLng,
            radiusKm: 100,
            limit: 30,
            tourType: 'uspon_na_vrh',
          }),
        )
        if (cancelled) return

        if (nearby.length > 0) {
          setGuides(nearby)
          setGuidesFromCatalog(false)
          setSelectedGuideIds(new Set(nearby.map((g) => g.id)))
          return
        }

        const catalog = filterValidGuides(
          await listGuidesCatalog({
            category: 'planine',
            limit: 100,
          }),
          false,
        )
        if (cancelled) return
        setGuides(catalog)
        setGuidesFromCatalog(true)
        setSelectedGuideIds(new Set())
      } catch {
        if (!cancelled) {
          setGuides([])
          setGuidesFromCatalog(false)
          setSelectedGuideIds(new Set())
        }
      } finally {
        if (!cancelled) setGuidesLoading(false)
      }
    }

    void loadGuides()
    return () => {
      cancelled = true
    }
  }, [props.open, step, props.peakLat, props.peakLng, hasMapCoords])

  const patch = (partial: Partial<FerrataGuideBookingFormState>) => {
    setForm((f) => ({ ...f, ...partial }))
    setLocalErr('')
  }

  const validateForm = (): string | null => {
    if (!form.desiredDate.trim()) return tShared('bookGuideErrDate')
    if (form.timeOfDay === 'exact' && !form.exactTime.trim()) return tShared('bookGuideErrExactTime')
    const n = Number(form.numberOfPeople)
    if (!Number.isFinite(n) || n < 1) return tShared('bookGuideErrPeople')
    if (!form.groupExperience) return tShared('bookGuideErrExperience')
    if (!form.equipmentStatus) return tShared('bookGuideErrEquipment')
    if (!form.contactPhone.trim()) return tShared('bookGuideErrPhone')
    return null
  }

  const requireLogin = (): boolean => {
    if (user) return true
    navigate('/login')
    return false
  }

  const goNextFromForm = (e: FormEvent) => {
    e.preventDefault()
    if (!requireLogin()) return
    const err = validateForm()
    if (err) {
      setLocalErr(err)
      return
    }
    if (!hasMapCoords) {
      void submitBooking(true)
      return
    }
    setStep(2)
  }

  const toggleGuide = (id: number) => {
    setSelectedGuideIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setLocalErr('')
  }

  const submitBooking = async (skipGuides: boolean) => {
    if (!requireLogin()) return
    const err = validateForm()
    if (err) {
      setLocalErr(err)
      setStep(1)
      return
    }
    const guideIds = skipGuides ? [] : [...selectedGuideIds]
    if (!skipGuides && guideIds.length === 0) {
      setLocalErr(tShared('bookGuideErrNoGuides'))
      return
    }
    setSubmitting(true)
    setLocalErr('')
    try {
      await createPeakGuideBooking({
        peakId: props.peakId,
        guideProfileIds: guideIds,
        skipGuides,
        desiredDate: form.desiredDate,
        timeOfDay: form.timeOfDay,
        exactTime: form.exactTime,
        dateFlexible: form.dateFlexible,
        numberOfPeople: Number(form.numberOfPeople),
        groupExperience: form.groupExperience,
        equipmentStatus: form.equipmentStatus,
        contactPhone: form.contactPhone.trim(),
        additionalMessage: form.additionalMessage.trim(),
      })
      setStep(3)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        tShared('bookGuideSubmitError')
      setLocalErr(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const stepTitle = useMemo(() => {
    if (step === 1) return t('bookGuideTitle')
    if (step === 2) return tShared('bookGuideStepGuidesTitle')
    return tShared('bookGuideStepHotelsTitle')
  }, [step, t, tShared])

  const viewAllHotels = () => {
    props.onClose()
    navigate(`/mapa${PEAK_HOTELS_HASH}`)
  }

  if (!props.open) return null

  const timeOptions: { value: GuideBookingTimeOfDay; label: string }[] = [
    { value: 'morning', label: tShared('bookGuideTimeMorning') },
    { value: 'afternoon', label: tShared('bookGuideTimeAfternoon') },
    { value: 'any', label: tShared('bookGuideTimeAny') },
    { value: 'exact', label: tShared('bookGuideTimeExact') },
  ]
  const experienceOptions: { value: GuideBookingGroupExperience; label: string }[] = [
    { value: 'beginners', label: tShared('whoBeginners') },
    { value: 'recreational', label: tShared('whoRecreational') },
    { value: 'experienced', label: tShared('whoExperienced') },
    { value: 'mixed', label: tShared('bookGuideExperienceMixed') },
  ]
  const equipmentOptions: { value: GuideBookingEquipmentStatus; label: string }[] = [
    { value: 'complete', label: t('bookGuideEquipmentComplete') },
    { value: 'none', label: t('bookGuideEquipmentNone') },
    { value: 'partial', label: t('bookGuideEquipmentPartial') },
    { value: 'unsure', label: t('bookGuideEquipmentUnsure') },
  ]

  const primaryBtnClass =
    'w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm'
  const secondaryBtnClass =
    'flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50'

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex justify-center bg-black/50 px-3 pt-[calc(3.5rem+0.75rem)] pb-[calc(5rem+0.75rem)] backdrop-blur-sm md:items-center md:p-6"
      role="dialog"
      aria-modal
      aria-labelledby="peak-guide-booking-title"
    >
      <div className="flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-xl ring-1 ring-black/[0.04] md:h-auto md:max-h-[min(85vh,680px)]">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5">
          <div>
            <h2 id="peak-guide-booking-title" className="text-base font-bold text-gray-900">
              {stepTitle}
            </h2>
            {step > 1 && (
              <p className="text-[11px] text-gray-500">
                {tShared('bookGuideStepIndicator', { current: step, total: 3 })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
            aria-label={tShared('modalClose')}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {step === 1 && (
            <form id="peak-guide-booking-form" onSubmit={goNextFromForm} className="space-y-5">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">{t('bookGuidePeakSection')}</p>
                <p className="text-sm font-bold text-gray-900">{props.peakName}</p>
                {props.peakMountain.trim() && <p className="text-xs text-gray-600">{props.peakMountain.trim()}</p>}
                {props.peakLocation.trim() && <p className="text-xs text-gray-500">{props.peakLocation.trim()}</p>}
                {props.peakHeightM != null && props.peakHeightM > 0 && (
                  <p className="text-xs font-semibold text-indigo-700">{props.peakHeightM} m</p>
                )}
              </div>
              <Fieldset title={tShared('bookGuideDateSection')}>
                <div>
                  <label htmlFor="book-desired-date" className="block text-sm font-medium text-gray-700 mb-1">
                    {tShared('bookGuideDesiredDate')}
                  </label>
                  <input
                    id="book-desired-date"
                    type="date"
                    value={form.desiredDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => patch({ desiredDate: e.target.value })}
                    className={baseInput}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.dateFlexible}
                    onChange={(e) => patch({ dateFlexible: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  {tShared('bookGuideDateFlexible')}
                </label>
              </Fieldset>
              <Fieldset title={tShared('bookGuideTimeSection')}>
                <div className="flex flex-wrap gap-2">
                  {timeOptions.map((opt) => (
                    <ChipOption
                      key={opt.value}
                      name="timeOfDay"
                      value={opt.value}
                      checked={form.timeOfDay === opt.value}
                      label={opt.label}
                      onChange={(v) => patch({ timeOfDay: v as GuideBookingTimeOfDay })}
                    />
                  ))}
                </div>
                {form.timeOfDay === 'exact' && (
                  <div>
                    <label htmlFor="book-exact-time" className="block text-sm font-medium text-gray-700 mb-1">
                      {tShared('bookGuideExactTimeLabel')}
                    </label>
                    <input
                      id="book-exact-time"
                      type="time"
                      value={form.exactTime}
                      onChange={(e) => patch({ exactTime: e.target.value })}
                      className={baseInput}
                    />
                  </div>
                )}
              </Fieldset>
              <div>
                <label htmlFor="book-people" className={labelClass}>
                  {tShared('bookGuidePeople')}
                </label>
                <input
                  id="book-people"
                  type="number"
                  min={1}
                  max={99}
                  value={form.numberOfPeople}
                  onChange={(e) => patch({ numberOfPeople: e.target.value })}
                  className={baseInput}
                />
              </div>
              <Fieldset title={tShared('bookGuideExperienceSection')}>
                <div className="flex flex-wrap gap-2">
                  {experienceOptions.map((opt) => (
                    <ChipOption
                      key={opt.value}
                      name="groupExperience"
                      value={opt.value}
                      checked={form.groupExperience === opt.value}
                      label={opt.label}
                      onChange={(v) => patch({ groupExperience: v as GuideBookingGroupExperience })}
                    />
                  ))}
                </div>
              </Fieldset>
              <Fieldset title={t('bookGuideEquipmentSection')}>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {equipmentOptions.map((opt) => (
                    <ChipOption
                      key={opt.value}
                      name="equipmentStatus"
                      value={opt.value}
                      checked={form.equipmentStatus === opt.value}
                      label={opt.label}
                      onChange={(v) => patch({ equipmentStatus: v as GuideBookingEquipmentStatus })}
                    />
                  ))}
                </div>
              </Fieldset>
              <div>
                <label htmlFor="book-phone" className={labelClass}>
                  {tShared('bookGuidePhone')}
                </label>
                <input
                  id="book-phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.contactPhone}
                  onChange={(e) => patch({ contactPhone: e.target.value })}
                  className={baseInput}
                />
              </div>
              <div>
                <label htmlFor="book-message" className={labelClass}>
                  {tShared('bookGuideMessage')}
                </label>
                <textarea
                  id="book-message"
                  rows={3}
                  value={form.additionalMessage}
                  onChange={(e) => patch({ additionalMessage: e.target.value })}
                  className={`${baseInput} resize-y min-h-[4.5rem]`}
                  placeholder={t('bookGuideMessagePlaceholderPeak')}
                />
              </div>

              {localErr && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
                  {localErr}
                </p>
              )}

              <button type="submit" className={`${primaryBtnClass} mt-2`}>
                {tShared('bookGuideNext')}
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {guidesFromCatalog ? tShared('bookGuideSearchOthersPrompt') : t('bookGuideStepGuidesHintPeak')}
              </p>

              {guidesFromCatalog && !guidesLoading && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                  {t('bookGuideNoGuidesNearbyPeak')}
                </p>
              )}

              <div>
                <label htmlFor="book-guide-search" className="sr-only">
                  {tShared('bookGuideSearchPlaceholder')}
                </label>
                <input
                  id="book-guide-search"
                  type="search"
                  value={guideSearch}
                  onChange={(e) => setGuideSearch(e.target.value)}
                  placeholder={tShared('bookGuideSearchPlaceholder')}
                  className={baseInput}
                  autoComplete="off"
                />
              </div>

              {guidesLoading && <p className="text-sm text-gray-500">…</p>}

              {!guidesLoading && guides.length === 0 && !guidesFromCatalog && (
                <p className="text-sm text-gray-500">{tShared('detailGuidesEmpty')}</p>
              )}

              {!guidesLoading && guides.length > 0 && filteredGuides.length === 0 && (
                <p className="text-sm text-gray-500">{tShared('bookGuideSearchEmpty')}</p>
              )}

              {!guidesLoading && filteredGuides.length > 0 && (
                <ul className="grid min-w-0 gap-3">
                  {filteredGuides.map((g) => (
                    <GuideNearbyCard
                      key={g.id}
                      guide={g}
                      t={tShared}
                      tGuide={tGuide}
                      selectable
                      selected={selectedGuideIds.has(g.id)}
                      onToggle={() => toggleGuide(g.id)}
                    />
                  ))}
                </ul>
              )}

              {localErr && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
                  {localErr}
                </p>
              )}

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => void submitBooking(true)}
                  disabled={submitting}
                  className="w-full text-center text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline disabled:opacity-50"
                >
                  {tShared('bookGuideSkipGuides')}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={submitting}
                    className={secondaryBtnClass}
                  >
                    {tShared('bookGuideBack')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitBooking(false)}
                    disabled={submitting || selectedGuideIds.size === 0}
                    className={`${primaryBtnClass} flex-1 disabled:opacity-60`}
                  >
                    {submitting ? '…' : tShared('bookGuideSubmit')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && hasMapCoords && (
            <FerrataGuideBookingHotelsStep
              ferrataLat={props.peakLat}
              ferrataLng={props.peakLng}
              onViewAllHotels={viewAllHotels}
            />
          )}

          {step === 3 && !hasMapCoords && (
            <p className="text-sm text-gray-600">{tShared('bookGuideDoneNoHotels')}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
