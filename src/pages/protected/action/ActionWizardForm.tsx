import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../../services/api'
import {
  type ActionWizardFormProps,
  type OrganizerKind,
  type WizardFerrataOption,
  type WizardGuide,
  type WizardOprema,
  type WizardPrevoz,
  type WizardSmestaj,
  type WizardValues,
  wizardBaseInput as baseInput,
  wizardLabelClass as labelClass,
  wizardNavBtnPrimary as navBtnPrimary,
  wizardNavBtnSecondary as navBtnSecondary,
  wizardNavBtnSubmit as navBtnSubmit,
} from './wizardTypes'

import { WizardStep1, WizardStep2, WizardStep3, WizardStep4 } from './ActionWizardSteps'
import type { WizardStepProps } from './wizardStepProps'

export type { OrganizerKind, WizardGuide, WizardSmestaj, WizardOprema, WizardPrevoz, WizardFerrataOption, WizardValues }

export function ActionWizardForm({
  title,
  badge,
  submitText,
  submitLoadingText,
  guides,
  initialValues,
  initialImageUrl,
  clubCurrency,
  loading,
  error,
  success,
  minDate,
  imageHelpText,
  lockActionKind = false,
  ferrataCatalog = [],
  lockFerrataSelection = false,
  lockOrganizerType = false,
  onSubmit,
}: ActionWizardFormProps) {
  const { t } = useTranslation('actionForms')
  const { t: tFr } = useTranslation('ferrate')
  const [step, setStep] = useState(1)
  const [values, setValues] = useState<WizardValues>(initialValues)
  const [image, setImage] = useState<File | null>(null)
  const [geoQuery, setGeoQuery] = useState('')
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoErr, setGeoErr] = useState('')

  useEffect(() => {
    setValues(initialValues)
  }, [initialValues])

  const hintCenterForMountain = useMemo(() => {
    const la = parseFloat(String(values.planinaLat).replace(',', '.'))
    const ln = parseFloat(String(values.planinaLng).replace(',', '.'))
    if (Number.isFinite(la) && Number.isFinite(ln)) return { lat: la, lng: ln }
    return null
  }, [values.planinaLat, values.planinaLng])

  const isVia = values.actionKind === 'via_ferrata'

  const patch = (data: Partial<WizardValues>) => setValues((prev) => ({ ...prev, ...data }))

  const runGeocode = async () => {
    const q = (geoQuery.trim() || `${values.planina}, ${values.vrh}`).trim()
    if (q.length < 3) {
      setGeoErr(t('fields.planinaGeocodeMinQuery'))
      return
    }
    setGeoErr('')
    setGeoBusy(true)
    try {
      const res = await api.get<{ lat: number; lng: number }>('/api/geocode', { params: { q } })
      patch({
        planinaLat: Number(res.data.lat).toFixed(6),
        planinaLng: Number(res.data.lng).toFixed(6),
      })
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } }).response?.data?.error || t('fields.planinaGeocodeNoResults')
      setGeoErr(msg)
    } finally {
      setGeoBusy(false)
    }
  }

  const maxStep = isVia ? 3 : 4

  const selectedFerrata = useMemo(
    () => ferrataCatalog.find((x) => String(x.id) === values.ferrataId.trim()),
    [ferrataCatalog, values.ferrataId],
  )

  useEffect(() => {
    if (isVia && step > 3) setStep(3)
  }, [isVia, step])

  const isPublic = values.visibility === 'javna'
  const brojDana = Number(values.brojDana || '1')
  const showSmestaj = brojDana > 1

  const totalOptionalPreview = useMemo(() => {
    const sm = values.smestaj.reduce((acc, s) => acc + Number(s.cenaPoOsobiUkupno || 0), 0)
    const pr = values.prevoz.reduce((acc, p) => acc + Number(p.cenaPoOsobi || 0), 0)
    const op = values.oprema.reduce((acc, o) => acc + Number(o.cenaPoSetu || 0), 0)
    return sm + pr + op
  }, [values])

  const toStepLabel = (currentStep: number) => {
    if (currentStep === 1) return t('wizard.tabs.basic')
    if (currentStep === 2) return t('wizard.tabs.logistics')
    if (isVia && currentStep === 3) return t('wizard.tabs.summary')
    if (currentStep === 3) return t('wizard.tabs.equipment')
    return t('wizard.tabs.transportOptions')
  }
  const visibilityLabel = values.visibility === 'javna' ? t('wizard.visibility.public') : t('wizard.visibility.club')
  const organizerLabel =
    values.organizerType === 'vodic' ? t('wizard.organizer.guide') : t('wizard.organizer.club')
  const isGuideOrganizer = values.organizerType === 'vodic'
  const selectedGuide = guides.find((g) => String(g.id) === values.vodicId)
  const selectedGuideLabel = selectedGuide
    ? `${selectedGuide.fullName} (@${selectedGuide.username})`
    : ''

  const guideDropdownOptions = useMemo(() => {
    const club = guides.filter((g) => g.source !== 'profi')
    const profi = guides.filter((g) => g.source === 'profi')
    const opts: { value: string; label: string; disabled?: boolean }[] = [{ value: '', label: t('guide.pick') }]
    if (club.length > 0) {
      opts.push({ value: '__club_hdr__', label: t('wizard.guidePicker.clubSection'), disabled: true })
      for (const g of club) {
        opts.push({ value: String(g.id), label: `${g.fullName} (@${g.username})` })
      }
    }
    if (profi.length > 0) {
      opts.push({ value: '__profi_hdr__', label: t('wizard.guidePicker.profiSection'), disabled: true })
      for (const g of profi) {
        opts.push({ value: String(g.id), label: `${g.fullName} (@${g.username})` })
      }
    }
    if (club.length === 0 && profi.length === 0) {
      for (const g of guides) {
        opts.push({ value: String(g.id), label: `${g.fullName} (@${g.username})` })
      }
    }
    return opts
  }, [guides, t])

  const addSmestaj = () =>
    patch({
      smestaj: [
        ...values.smestaj,
        { localId: `s-${Date.now()}`, naziv: '', cenaPoOsobiUkupno: '', opis: '' },
      ],
    })
  const addOprema = () =>
    patch({
      oprema: [
        ...values.oprema,
        { localId: `o-${Date.now()}`, naziv: '', dostupnaKolicina: '', cenaPoSetu: '' },
      ],
    })
  const addPrevoz = () =>
    patch({
      prevoz: [
        ...values.prevoz,
        { localId: `p-${Date.now()}`, tipPrevoza: '', nazivGrupe: '', kapacitet: '', cenaPoOsobi: '' },
      ],
    })

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step < maxStep) return
    await onSubmit(values, isVia ? null : image)
  }

  const stepProps: WizardStepProps = {
    values,
    patch,
    setValues,
    setStep,
    setImage,
    image,
    setGeoErr,
    t,
    tFr,
    baseInput,
    labelClass,
    clubCurrency,
    isVia,
    isGuideOrganizer,
    isPublic,
    lockActionKind,
    lockFerrataSelection,
    lockOrganizerType,
    ferrataCatalog,
    selectedFerrata,
    selectedGuideLabel,
    guideDropdownOptions,
    guides,
    minDate,
    initialImageUrl,
    imageHelpText,
    geoQuery,
    setGeoQuery,
    geoBusy,
    geoErr,
    runGeocode,
    organizerLabel,
    visibilityLabel,
    showSmestaj,
    addSmestaj,
    addOprema,
    addPrevoz,
    hintCenterForMountain,
    totalOptionalPreview,
    showTransport: !isVia,
  }
  return (
    <form onSubmit={handleFormSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 lg:p-7 space-y-6">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs sm:text-sm text-rose-700">{error}</div>}

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600 mb-1">{badge}</p>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold tracking-tight text-gray-900">{title}</h1>
        </div>
        <div className="inline-flex items-center rounded-xl bg-gray-50 border border-gray-100 p-1">
          {Array.from({ length: maxStep }, (_, i) => i + 1).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-[0.96] ${step === s ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
            >
              {s}. {toStepLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {step === 1 && <WizardStep1 {...stepProps} />}
      {step === 2 && <WizardStep2 {...stepProps} />}
      {step === 3 && !isVia && <WizardStep3 {...stepProps} />}
      {((step === 3 && isVia) || (step === 4 && !isVia)) && <WizardStep4 {...stepProps} />}
      <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-gray-100">
        <button type="button" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))} className={navBtnSecondary}>
          {t('wizard.navigation.back')}
        </button>
        <div className="flex flex-wrap gap-2 justify-end">
          {step < maxStep && (
            <button type="button" onClick={() => setStep((s) => Math.min(maxStep, s + 1))} className={navBtnPrimary}>
              {t('wizard.navigation.nextStep')}
            </button>
          )}
          {step === maxStep && (
            <button type="submit" disabled={loading} className={navBtnSubmit}>
              {loading ? submitLoadingText : submitText}
            </button>
          )}
        </div>
      </div>

      {success && <p className="text-center text-xs font-medium text-emerald-600">{success}</p>}
    </form>
  )
}
