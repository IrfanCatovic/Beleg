import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import {
  emptyGuideBookingForm,
  type FerrataGuideBookingFormState,
  type GuideBookingEquipmentStatus,
  type GuideBookingGroupExperience,
  type GuideBookingTimeOfDay,
} from './ferrataGuideBookingTypes'

const baseInput =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 outline-none transition'
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-[0.16em]'

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

export function FerrataGuideBookingModal(props: {
  open: boolean
  onClose: () => void
  ferrataId: number
  ferrataName: string
  ferrataLocation: string
}) {
  const { t } = useTranslation('ferrate')
  const { user } = useAuth()
  const [form, setForm] = useState<FerrataGuideBookingFormState>(emptyGuideBookingForm)
  const [localErr, setLocalErr] = useState('')

  useEffect(() => {
    if (!props.open) return
    setForm(emptyGuideBookingForm())
    setLocalErr('')
    if (!user) return
    api
      .get('/api/me')
      .then((res) => {
        const tel = (res.data?.telefon as string | undefined)?.trim()
        if (tel) setForm((f) => ({ ...f, contactPhone: tel }))
      })
      .catch(() => {})
  }, [props.open, user])

  const patch = (partial: Partial<FerrataGuideBookingFormState>) => {
    setForm((f) => ({ ...f, ...partial }))
    setLocalErr('')
  }

  const validate = (): string | null => {
    if (!form.desiredDate.trim()) return t('bookGuideErrDate')
    if (form.timeOfDay === 'exact' && !form.exactTime.trim()) return t('bookGuideErrExactTime')
    const n = Number(form.numberOfPeople)
    if (!Number.isFinite(n) || n < 1) return t('bookGuideErrPeople')
    if (!form.groupExperience) return t('bookGuideErrExperience')
    if (!form.equipmentStatus) return t('bookGuideErrEquipment')
    if (!form.contactPhone.trim()) return t('bookGuideErrPhone')
    return null
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) {
      setLocalErr(err)
      return
    }
    // Backend u sledećem koraku — za sada samo priprema forme
    setLocalErr(t('bookGuideSubmitSoon'))
  }

  if (!props.open) return null

  const timeOptions: { value: GuideBookingTimeOfDay; label: string }[] = [
    { value: 'morning', label: t('bookGuideTimeMorning') },
    { value: 'afternoon', label: t('bookGuideTimeAfternoon') },
    { value: 'any', label: t('bookGuideTimeAny') },
    { value: 'exact', label: t('bookGuideTimeExact') },
  ]

  const experienceOptions: { value: GuideBookingGroupExperience; label: string }[] = [
    { value: 'beginners', label: t('whoBeginners') },
    { value: 'recreational', label: t('whoRecreational') },
    { value: 'experienced', label: t('whoExperienced') },
    { value: 'mixed', label: t('bookGuideExperienceMixed') },
  ]

  const equipmentOptions: { value: GuideBookingEquipmentStatus; label: string }[] = [
    { value: 'complete', label: t('bookGuideEquipmentComplete') },
    { value: 'none', label: t('bookGuideEquipmentNone') },
    { value: 'partial', label: t('bookGuideEquipmentPartial') },
    { value: 'unsure', label: t('bookGuideEquipmentUnsure') },
  ]

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal
      aria-labelledby="ferrata-guide-booking-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose()
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-xl ring-1 ring-black/[0.04]">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5">
          <h2 id="ferrata-guide-booking-title" className="text-base font-bold text-gray-900">
            {t('bookGuideTitle')}
          </h2>
          <button
            type="button"
            onClick={props.onClose}
            className="text-sm font-semibold text-gray-500 hover:text-gray-800"
          >
            {t('modalClose')}
          </button>
        </div>

        <form
          id="ferrata-guide-booking-form"
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 space-y-5"
        >
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">{t('bookGuideFerrataSection')}</p>
            <p className="text-sm font-bold text-gray-900">{props.ferrataName}</p>
            {props.ferrataLocation.trim() && (
              <p className="text-xs text-gray-600">{props.ferrataLocation.trim()}</p>
            )}
          </div>

          <Fieldset title={t('bookGuideDateSection')}>
            <div>
              <label htmlFor="book-desired-date" className="block text-sm font-medium text-gray-700 mb-1">
                {t('bookGuideDesiredDate')}
              </label>
              <input
                id="book-desired-date"
                type="date"
                value={form.desiredDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => patch({ desiredDate: e.target.value })}
                className={baseInput}
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.dateFlexible}
                onChange={(e) => patch({ dateFlexible: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              {t('bookGuideDateFlexible')}
            </label>
          </Fieldset>

          <Fieldset title={t('bookGuideTimeSection')}>
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
                  {t('bookGuideExactTimeLabel')}
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
              {t('bookGuidePeople')}
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

          <Fieldset title={t('bookGuideExperienceSection')}>
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
              {t('bookGuidePhone')}
            </label>
            <input
              id="book-phone"
              type="tel"
              autoComplete="tel"
              value={form.contactPhone}
              onChange={(e) => patch({ contactPhone: e.target.value })}
              className={baseInput}
              placeholder="+381 …"
            />
          </div>

          <div>
            <label htmlFor="book-message" className={labelClass}>
              {t('bookGuideMessage')}
            </label>
            <textarea
              id="book-message"
              rows={3}
              value={form.additionalMessage}
              onChange={(e) => patch({ additionalMessage: e.target.value })}
              className={`${baseInput} resize-y min-h-[4.5rem]`}
              placeholder={t('bookGuideMessagePlaceholder')}
            />
          </div>

          {localErr && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
              {localErr}
            </p>
          )}

          <p className="text-xs text-gray-500">{t('bookGuideFooterHint')}</p>
        </form>

        <div className="shrink-0 border-t border-gray-100 px-4 py-3 sm:px-5 flex gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {t('modalClose')}
          </button>
          <button
            type="submit"
            form="ferrata-guide-booking-form"
            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:from-emerald-600 hover:to-teal-700"
          >
            {t('bookGuideSubmit')}
          </button>
        </div>
      </div>
    </div>
  )
}
