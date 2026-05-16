import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import { GuideBaseLocationPicker } from './GuideBaseLocationPicker'
import { GUIDE_TOUR_TYPE_KEYS, type GuideTourTypeKey } from '../../i18n/guideProfiles'
import type { GuideApplyPayload, GuideProfile } from '../../services/guideProfiles'

export type GuideWizardFormState = {
  naslov: string
  opis: string
  drzava: string
  region: string
  grad: string
  baseLat: string
  baseLng: string
  godineIskustva: string
  jezici: string
  sertifikatiOpis: string
  tourTypes: GuideTourTypeKey[]
  telefon: string
}

const baseInput =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 outline-none transition'
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-[0.16em]'

const navBtnBase =
  'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 active:scale-[0.97]'
const navBtnSecondary = `${navBtnBase} border border-gray-200 text-gray-600 bg-white hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-800 disabled:opacity-40`
const navBtnPrimary = `${navBtnBase} border border-emerald-300 text-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100`
const navBtnSubmit = `${navBtnBase} text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-60`

export function emptyGuideWizardForm(): GuideWizardFormState {
  return {
    naslov: '',
    opis: '',
    drzava: '',
    region: '',
    grad: '',
    baseLat: '',
    baseLng: '',
    godineIskustva: '0',
    jezici: '',
    sertifikatiOpis: '',
    tourTypes: [],
    telefon: '',
  }
}

export function guideProfileToForm(gp: GuideProfile): GuideWizardFormState {
  return {
    naslov: gp.naslov ?? '',
    opis: gp.opis ?? '',
    drzava: gp.drzava ?? '',
    region: gp.region ?? '',
    grad: gp.grad ?? '',
    baseLat: gp.baseLat != null ? String(gp.baseLat) : '',
    baseLng: gp.baseLng != null ? String(gp.baseLng) : '',
    godineIskustva: String(gp.godineIskustva ?? 0),
    jezici: (gp.jezici ?? []).join(', '),
    sertifikatiOpis: gp.sertifikatiOpis ?? '',
    tourTypes: (gp.tourTypes ?? []).filter((t): t is GuideTourTypeKey =>
      (GUIDE_TOUR_TYPE_KEYS as readonly string[]).includes(t),
    ),
    telefon: gp.user?.telefon ?? '',
  }
}

function parseCoord(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function formToPayload(form: GuideWizardFormState, telefonFallback: string): GuideApplyPayload | null {
  const lat = parseCoord(form.baseLat)
  const lng = parseCoord(form.baseLng)
  if (lat == null || lng == null) return null
  const jezici = form.jezici
    .split(/[,;]+/)
    .map((j) => j.trim())
    .filter(Boolean)
  if (jezici.length === 0 || form.tourTypes.length === 0) return null
  const grad = form.grad.trim()
  const region = form.region.trim()
  if (!grad && !region) return null
  return {
    naslov: form.naslov.trim(),
    opis: form.opis.trim(),
    drzava: form.drzava.trim() || undefined,
    region: region || undefined,
    grad: grad || undefined,
    baseLat: lat,
    baseLng: lng,
    godineIskustva: Math.max(0, Number(form.godineIskustva) || 0),
    jezici,
    sertifikatiOpis: form.sertifikatiOpis.trim() || undefined,
    tourTypes: form.tourTypes,
    telefon: (form.telefon.trim() || telefonFallback.trim()) || undefined,
  }
}

type MeInfo = {
  fullName?: string
  email?: string
  telefon?: string
  avatar_url?: string
  username?: string
}

export function GuideApplicationWizard(props: {
  mode: 'create' | 'edit'
  initialForm: GuideWizardFormState
  loading: boolean
  error: string
  onSubmit: (payload: GuideApplyPayload) => void | Promise<void>
}) {
  const { t } = useTranslation('guideProfiles')
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<GuideWizardFormState>(props.initialForm)
  const [me, setMe] = useState<MeInfo | null>(null)
  const [localErr, setLocalErr] = useState('')

  useEffect(() => {
    setForm(props.initialForm)
  }, [props.initialForm])

  useEffect(() => {
    void api
      .get<MeInfo>('/api/me')
      .then((res) => setMe(res.data))
      .catch(() => setMe(null))
  }, [])

  const patch = (data: Partial<GuideWizardFormState>) => setForm((prev) => ({ ...prev, ...data }))

  const accountTelefon = (me?.telefon || form.telefon || '').trim()
  const needsTelefon = !accountTelefon

  const toggleTour = (key: GuideTourTypeKey) => {
    setForm((prev) => {
      const has = prev.tourTypes.includes(key)
      return {
        ...prev,
        tourTypes: has ? prev.tourTypes.filter((x) => x !== key) : [...prev.tourTypes, key],
      }
    })
  }

  const validateStep = (s: number): boolean => {
    if (s === 1) {
      if (!form.naslov.trim()) return false
      if (form.opis.trim().length < 30) return false
      if (needsTelefon && !form.telefon.trim()) return false
      const jezici = form.jezici.split(/[,;]+/).map((j) => j.trim()).filter(Boolean)
      if (jezici.length === 0) return false
      return true
    }
    if (s === 2) {
      const lat = parseCoord(form.baseLat)
      const lng = parseCoord(form.baseLng)
      if (lat == null || lng == null) return false
      if (!form.grad.trim() && !form.region.trim()) return false
      return true
    }
    if (s === 3) return form.tourTypes.length > 0
    return true
  }

  const handleNext = () => {
    if (!validateStep(step)) {
      setLocalErr(t('errors.validation'))
      return
    }
    setLocalErr('')
    setStep((s) => Math.min(3, s + 1))
  }

  const handleSubmit = () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      setLocalErr(t('errors.validation'))
      return
    }
    const payload = formToPayload(form, accountTelefon)
    if (!payload) {
      setLocalErr(t('errors.validation'))
      return
    }
    setLocalErr('')
    void props.onSubmit(payload)
  }

  const displayErr = props.error || localErr
  const submitLabel = props.mode === 'edit' ? t('wizard.update') : t('wizard.submit')
  const submitLoading = props.mode === 'edit' ? t('wizard.updateLoading') : t('wizard.submitLoading')

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-8 shadow-sm">
      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-100 pb-4">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => n < step && setStep(n)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
              step === n
                ? 'bg-emerald-600 text-white'
                : n < step
                  ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-gray-50 text-gray-400'
            }`}
          >
            {n === 1 ? t('wizard.tabs.info') : n === 2 ? t('wizard.tabs.location') : t('wizard.tabs.tours')}
          </button>
        ))}
      </div>

      {displayErr && (
        <p className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{displayErr}</p>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">{t('step1.accountTitle')}</p>
            <div className="flex items-center gap-3">
                {me?.avatar_url ? (
                  <img src={me.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white font-bold">
                    {(me?.fullName || me?.username || '?').charAt(0)}
                  </div>
                )}
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-gray-900 truncate">{me?.fullName || me?.username}</p>
                  {me?.email && <p className="text-gray-500 truncate">{me.email}</p>}
                  {accountTelefon ? (
                    <p className="text-gray-600">{accountTelefon}</p>
                  ) : (
                    <p className="text-amber-700 text-xs mt-1">{t('step1.telefonMissing')}</p>
                  )}
                </div>
              </div>
            {needsTelefon && (
              <div className="mt-3">
                <label className={labelClass}>{t('step1.telefonInline')}</label>
                <input
                  className={baseInput}
                  value={form.telefon}
                  onChange={(e) => patch({ telefon: e.target.value })}
                  placeholder="+381…"
                />
                <p className="mt-1 text-xs text-gray-500">
                  <Link to="/profil/podesavanja" className="text-emerald-700 font-medium hover:underline">
                    {t('step1.settingsLink')}
                  </Link>
                </p>
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>{t('step1.naslov')}</label>
            <input
              className={baseInput}
              value={form.naslov}
              onChange={(e) => patch({ naslov: e.target.value })}
              placeholder={t('step1.naslovPlaceholder')}
            />
          </div>
          <div>
            <label className={labelClass}>{t('step1.opis')}</label>
            <textarea
              className={`${baseInput} min-h-[120px]`}
              value={form.opis}
              onChange={(e) => patch({ opis: e.target.value })}
              placeholder={t('step1.opisPlaceholder')}
            />
            <p className="mt-1 text-xs text-gray-400">{t('step1.opisHint')}</p>
          </div>
          <div>
            <label className={labelClass}>{t('step1.godineIskustva')}</label>
            <input
              type="number"
              min={0}
              className={baseInput}
              value={form.godineIskustva}
              onChange={(e) => patch({ godineIskustva: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>{t('step1.jezici')}</label>
            <input
              className={baseInput}
              value={form.jezici}
              onChange={(e) => patch({ jezici: e.target.value })}
              placeholder={t('step1.jeziciPlaceholder')}
            />
            <p className="mt-1 text-xs text-gray-400">{t('step1.jeziciHint')}</p>
          </div>
          <div>
            <label className={labelClass}>{t('step1.sertifikati')}</label>
            <textarea
              className={`${baseInput} min-h-[80px]`}
              value={form.sertifikatiOpis}
              onChange={(e) => patch({ sertifikatiOpis: e.target.value })}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <GuideBaseLocationPicker
          drzava={form.drzava}
          region={form.region}
          grad={form.grad}
          baseLat={form.baseLat}
          baseLng={form.baseLng}
          onDrzavaChange={(v) => patch({ drzava: v })}
          onRegionChange={(v) => patch({ region: v })}
          onGradChange={(v) => patch({ grad: v })}
          onBaseLatChange={(v) => patch({ baseLat: v })}
          onBaseLngChange={(v) => patch({ baseLng: v })}
        />
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-3">{t('step3.tourTypes')}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {GUIDE_TOUR_TYPE_KEYS.map((key) => (
                <label
                  key={key}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                    form.tourTypes.includes(key)
                      ? 'border-emerald-400 bg-emerald-50/80 text-emerald-900'
                      : 'border-gray-200 hover:border-emerald-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-emerald-600"
                    checked={form.tourTypes.includes(key)}
                    onChange={() => toggleTour(key)}
                  />
                  {t(`tourTypes.${key}`)}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm space-y-2">
            <h3 className="font-bold text-gray-800">{t('step3.review')}</h3>
            <p>
              <span className="text-gray-500">{t('step1.naslov')}:</span> {form.naslov}
            </p>
            <p>
              <span className="text-gray-500">{t('step2.selected')}:</span>{' '}
              {[form.grad, form.region, form.drzava].filter(Boolean).join(', ') || '—'}
            </p>
            <p>
              <span className="text-gray-500">{t('step3.tourTypes')}:</span>{' '}
              {form.tourTypes.map((k) => t(`tourTypes.${k}`)).join(', ')}
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-gray-100 pt-6">
        {step > 1 ? (
          <button type="button" className={navBtnSecondary} onClick={() => setStep((s) => s - 1)}>
            {t('wizard.back')}
          </button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <button type="button" className={navBtnPrimary} onClick={handleNext}>
            {t('wizard.next')}
          </button>
        ) : (
          <button type="button" className={navBtnSubmit} disabled={props.loading} onClick={handleSubmit}>
            {props.loading ? submitLoading : submitLabel}
          </button>
        )}
      </div>
    </div>
  )
}
