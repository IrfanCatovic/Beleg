import { useEffect, useMemo, useState } from 'react'
import Dropdown from '../../../components/Dropdown'
import CalendarDropdown from '../../../components/CalendarDropdown'
import type { ClubCurrencyCode } from '../../../utils/clubCurrency'
import { useTranslation } from 'react-i18next'
import { FerrataPinPicker } from '../../../components/ferrate/FerrataPinPicker'
import { FerrataCatalogAutocomplete } from '../../../components/ferrate/FerrataCatalogAutocomplete'
import { buildWizardPatchFromFerrataRow } from '../../../components/ferrate/ferrataWizardPrefill'
import api from '../../../services/api'

type ActionKind = 'planina' | 'via_ferrata'
type VisibilityKind = 'klubska' | 'javna'
export type OrganizerKind = 'klub' | 'vodic'

export interface WizardGuide {
  id: number
  username: string
  fullName: string
}

export interface WizardSmestaj {
  localId: string
  naziv: string
  cenaPoOsobiUkupno: string
  opis: string
}

export interface WizardOprema {
  localId: string
  naziv: string
  dostupnaKolicina: string
  cenaPoSetu: string
}

export interface WizardPrevoz {
  localId: string
  tipPrevoza: string
  nazivGrupe: string
  kapacitet: string
  cenaPoOsobi: string
}

export interface WizardFerrataOption {
  id: number
  naziv: string
  tezina: string
  drzava?: string
  gradOpstina?: string
  lokacija?: string
  duzinaM: number
  visinskaRazlikaM: number
  trajanjeMin: number
  trajanjeMax: number
  opis?: string
  quickTip?: string
}

export interface WizardValues {
  naziv: string
  actionKind: ActionKind
  organizerType: OrganizerKind
  visibility: VisibilityKind
  planina: string
  vrh: string
  datum: string
  vremePolaska: string
  ferrataId: string
  opis: string
  tezina: string
  kumulativniUsponM: string
  duzinaStazeKm: string
  visinaVrhM: string
  zimskiUspon: boolean
  vodicId: string
  drugiVodicCheck: boolean
  drugiVodicIme: string
  trajanjeSati: string
  rokPrijava: string
  maxLjudi: string
  mestoPolaska: string
  kontaktTelefon: string
  brojDana: string
  cenaClan: string
  cenaOstali: string
  prikaziListuPrijavljenih: boolean
  omoguciGrupniChat: boolean
  /** Geografska širina/dužina glavne tačke ture (planina) — obavezno za tip planina */
  planinaLat: string
  planinaLng: string
  smestaj: WizardSmestaj[]
  oprema: WizardOprema[]
  prevoz: WizardPrevoz[]
}

interface ActionWizardFormProps {
  title: string
  badge: string
  submitText: string
  submitLoadingText: string
  guides: WizardGuide[]
  initialValues: WizardValues
  initialImageUrl?: string
  /** Valuta kluba iz finansija — sve cene su u ovoj valuti */
  clubCurrency: ClubCurrencyCode
  loading: boolean
  error: string
  success: string
  minDate?: string
  imageHelpText?: string
  lockActionKind?: boolean
  ferrataCatalog?: WizardFerrataOption[]
  lockFerrataSelection?: boolean
  /** Zaključava tip organizatora (npr. zahtev za vođenje → uvek vodič). */
  lockOrganizerType?: boolean
  onSubmit: (values: WizardValues, image: File | null) => void | Promise<void>
}

const baseInput =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 outline-none transition'
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-[0.16em]'

const navBtnBase =
  'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 active:scale-[0.97]'
const navBtnSecondary =
  `${navBtnBase} border border-gray-200 text-gray-600 bg-white hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-800 disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100`
const navBtnPrimary =
  `${navBtnBase} border border-emerald-300 text-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 hover:border-emerald-400 hover:shadow-md`
const navBtnSubmit =
  `${navBtnBase} text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 hover:shadow-md disabled:opacity-60 disabled:cursor-wait disabled:active:scale-100`

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

  const cur = clubCurrency

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

      {step === 1 && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t('wizard.labels.actionType')}</label>
              {lockActionKind ? (
                <div className={`${baseInput} text-gray-700 bg-gray-50 cursor-not-allowed`} title={t('wizard.actionType.lockedHint')}>
                  {values.actionKind === 'via_ferrata' ? t('wizard.actionType.viaFerrata') : t('wizard.actionType.mountain')}
                </div>
              ) : (
                <Dropdown
                  aria-label={t('wizard.aria.actionType')}
                  options={[
                    { value: 'planina', label: t('wizard.actionType.mountain') },
                    { value: 'via_ferrata', label: t('wizard.actionType.viaFerrata') },
                  ]}
                  value={values.actionKind}
                  onChange={(v) => {
                    const k = v as ActionKind
                    if (k === 'via_ferrata') {
                      setImage(null)
                      setGeoErr('')
                      setValues((prev) => ({
                        ...prev,
                        actionKind: k,
                        smestaj: [],
                        oprema: [],
                        prevoz: [],
                        brojDana: '1',
                        mestoPolaska: '',
                        zimskiUspon: false,
                        visinaVrhM: '',
                        planinaLat: '',
                        planinaLng: '',
                      }))
                      setStep((s) => Math.min(s, 3))
                    } else {
                      patch({ actionKind: k })
                    }
                  }}
                  fullWidth
                />
              )}
            </div>
            <div>
              <label className={labelClass}>{t('wizard.labels.organizer')}</label>
              <Dropdown
                aria-label={t('wizard.aria.organizer')}
                options={[
                  { value: 'klub', label: t('wizard.organizer.club') },
                  { value: 'vodic', label: t('wizard.organizer.guide') },
                ]}
                value={values.organizerType}
                onChange={(v) => patch({ organizerType: v as OrganizerKind })}
                fullWidth
                disabled={lockOrganizerType}
              />
            </div>
            <div>
              <label className={labelClass}>{t('wizard.labels.visibility')}</label>
              <Dropdown
                aria-label={t('wizard.aria.visibility')}
                options={[
                  {
                    value: 'klubska',
                    label: isGuideOrganizer ? t('wizard.visibility.private') : t('wizard.visibility.club'),
                  },
                  { value: 'javna', label: t('wizard.visibility.public') },
                ]}
                value={values.visibility}
                onChange={(v) => patch({ visibility: v as VisibilityKind })}
                fullWidth
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
                {isGuideOrganizer ? t('wizard.visibility.guideHint') : t('wizard.visibility.clubHint')}
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{t('fields.actionName')}</label>
              <input required value={values.naziv} onChange={(e) => patch({ naziv: e.target.value })} placeholder={t('placeholders.actionName')} className={baseInput} />
            </div>
            {values.actionKind === 'via_ferrata' && (
              <div className="sm:col-span-2 space-y-3">
                <div>
                  <label className={labelClass}>{tFr('wizardSelectFerrata')}</label>
                  <FerrataCatalogAutocomplete
                    catalog={ferrataCatalog}
                    selectedId={values.ferrataId}
                    disabled={lockFerrataSelection}
                    onSelect={(row) => patch(buildWizardPatchFromFerrataRow(row, values))}
                    onClear={() =>
                      patch({
                        ferrataId: '',
                        tezina: '',
                        vrh: '',
                        kumulativniUsponM: '',
                        duzinaStazeKm: '',
                        trajanjeSati: '',
                      })
                    }
                  />
                </div>
                {selectedFerrata && (
                  <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-sky-100 bg-sky-50/50 px-3.5 py-3 text-sm text-gray-800">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">{t('fields.difficulty')}</p>
                      <p className="font-semibold">{selectedFerrata.tezina}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">{t('wizard.labels.durationHours')}</p>
                      <p className="font-semibold">
                        {tFr('cardDuration', {
                          min: Math.round(selectedFerrata.trajanjeMin),
                          max: Math.round(selectedFerrata.trajanjeMax),
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">{t('fields.ascentM')}</p>
                      <p className="font-semibold">{selectedFerrata.visinskaRazlikaM} m</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">{t('fields.trailLengthKm')}</p>
                      <p className="font-semibold">
                        {((selectedFerrata.duzinaM ?? 0) / 1000).toFixed(selectedFerrata.duzinaM % 1000 === 0 ? 0 : 1)} km
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!isVia && (
              <>
                <div>
                  <label className={labelClass}>{t('fields.mountain')}</label>
                  <input
                    required
                    value={values.planina}
                    onChange={(e) => patch({ planina: e.target.value })}
                    placeholder={t('placeholders.mountain')}
                    className={baseInput}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('fields.peak')}</label>
                  <input
                    required
                    value={values.vrh}
                    onChange={(e) => patch({ vrh: e.target.value })}
                    placeholder={t('placeholders.peak')}
                    className={baseInput}
                  />
                </div>
                <div className="sm:col-span-2 space-y-3">
                  <label className={labelClass}>{t('fields.planinaLocationTitle')}</label>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{t('fields.planinaLocationHint')}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">{t('fields.planinaLatShort')}</label>
                      <input
                        required
                        value={values.planinaLat}
                        onChange={(e) => patch({ planinaLat: e.target.value })}
                        className={baseInput}
                        inputMode="decimal"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">{t('fields.planinaLngShort')}</label>
                      <input
                        required
                        value={values.planinaLng}
                        onChange={(e) => patch({ planinaLng: e.target.value })}
                        className={baseInput}
                        inputMode="decimal"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <FerrataPinPicker
                    lat={values.planinaLat}
                    lng={values.planinaLng}
                    onLatChange={(lat) => patch({ planinaLat: lat })}
                    onLngChange={(lng) => patch({ planinaLng: lng })}
                    hintCenter={hintCenterForMountain}
                    mapHint={t('fields.planinaMapPickerHint')}
                    compact
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1 min-w-0">
                      <label className="mb-1 block text-xs font-medium text-gray-600">{t('fields.planinaGeocodeLabel')}</label>
                      <input
                        value={geoQuery}
                        onChange={(e) => {
                          setGeoQuery(e.target.value)
                          setGeoErr('')
                        }}
                        placeholder={t('fields.planinaGeocodePlaceholder')}
                        className={baseInput}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void runGeocode()}
                      disabled={geoBusy}
                      className="shrink-0 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {geoBusy ? t('fields.planinaGeocodeSearching') : t('fields.planinaGeocodeSearch')}
                    </button>
                  </div>
                  {geoErr ? <p className="text-[11px] text-rose-600">{geoErr}</p> : null}
                </div>
              </>
            )}
            <div>
              <label className={labelClass}>{t('fields.actionDate')}</label>
              <CalendarDropdown aria-label={t('fields.actionDate')} value={values.datum} onChange={(v) => patch({ datum: v })} minDate={minDate} fullWidth />
            </div>
            {values.actionKind === 'via_ferrata' && (
              <div>
                <label className={labelClass}>{tFr('wizardStartAt')}</label>
                <input
                  type="time"
                  required
                  value={values.vremePolaska}
                  onChange={(e) => patch({ vremePolaska: e.target.value })}
                  className={baseInput}
                />
              </div>
            )}
            <div>
              <label className={labelClass}>{t('fields.difficulty')}</label>
              {values.actionKind === 'planina' ? (
                <Dropdown
                  aria-label={t('fields.difficulty')}
                  options={[
                    { value: '', label: t('difficulty.pick') },
                    { value: 'lako', label: t('difficulty.easy') },
                    { value: 'srednje', label: t('difficulty.medium') },
                    { value: 'tesko', label: t('difficulty.hard') },
                    { value: 'alpinizam', label: t('difficulty.alpinism') },
                  ]}
                  value={values.tezina}
                  onChange={(v) => patch({ tezina: v })}
                  fullWidth
                />
              ) : (
                <div className={`${baseInput} bg-gray-50 text-gray-800 font-semibold`}>{values.tezina || '—'}</div>
              )}
            </div>
            {!isVia && (
              <div>
                <label className={labelClass}>{t('wizard.labels.durationHours')}</label>
                <input type="number" min="0.1" step="0.1" required value={values.trajanjeSati} onChange={(e) => patch({ trajanjeSati: e.target.value })} className={baseInput} />
              </div>
            )}
            <div>
              <label className={labelClass}>{t('wizard.labels.registrationDeadline')}</label>
              <CalendarDropdown aria-label={t('wizard.labels.registrationDeadline')} value={values.rokPrijava} onChange={(v) => patch({ rokPrijava: v })} fullWidth />
            </div>
            <div>
              <label className={labelClass}>{t('wizard.labels.maxPeople')}</label>
              <input type="number" min="0" step="1" value={values.maxLjudi} onChange={(e) => patch({ maxLjudi: e.target.value })} className={baseInput} />
            </div>
            {!isVia && (
              <>
                <div>
                  <label className={labelClass}>{t('fields.ascentM')}</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={values.kumulativniUsponM}
                    onChange={(e) => patch({ kumulativniUsponM: e.target.value })}
                    placeholder={t('placeholders.ascentM')}
                    className={baseInput}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('fields.trailLengthKm')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    value={values.duzinaStazeKm}
                    onChange={(e) => patch({ duzinaStazeKm: e.target.value })}
                    placeholder={t('placeholders.lengthKm')}
                    className={baseInput}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('fields.peakHeightM')}</label>
                  <input type="number" min="0" step="1" value={values.visinaVrhM} onChange={(e) => patch({ visinaVrhM: e.target.value })} placeholder={t('placeholders.peakHeightM')} className={baseInput} />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="zimski-uspon-wizard"
                    checked={values.zimskiUspon}
                    onChange={(e) => patch({ zimskiUspon: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                  />
                  <label htmlFor="zimski-uspon-wizard" className="text-sm text-gray-700 font-medium">
                    {t('fields.winterAscent')}
                  </label>
                </div>
              </>
            )}
          </div>
          <div>
            <label className={labelClass}>{t('fields.description')}</label>
            <textarea rows={4} value={values.opis} onChange={(e) => patch({ opis: e.target.value })} placeholder={t('placeholders.description')} className={`${baseInput} min-h-[90px]`} />
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-950">
            <span className="font-semibold">{t('wizard.currency.title')}</span> {cur}. {t('wizard.currency.help', { currency: cur })}
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-4">
            {isGuideOrganizer ? (
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>{t('fields.guide')}</label>
                  <div
                    className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-sm font-semibold text-gray-900"
                    aria-readonly="true"
                  >
                    {selectedGuideLabel || t('guide.pick')}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {!values.drugiVodicCheck && (
                    <div>
                      <label className={labelClass}>{t('fields.guide')}</label>
                      <Dropdown
                        aria-label={t('fields.guide')}
                        options={[
                          { value: '', label: t('guide.pick') },
                          ...guides.map((v) => ({ value: String(v.id), label: `${v.fullName} (@${v.username})` })),
                        ]}
                        value={values.vodicId}
                        onChange={(v) => patch({ vodicId: v })}
                        fullWidth
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2 self-end">
                    <input
                      type="checkbox"
                      id="drugi-vodic"
                      checked={values.drugiVodicCheck}
                      onChange={(e) => {
                        const checked = e.target.checked
                        patch({ drugiVodicCheck: checked, vodicId: checked ? '' : values.vodicId, drugiVodicIme: checked ? values.drugiVodicIme : '' })
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    <label htmlFor="drugi-vodic" className="text-sm text-gray-700">
                      {t('fields.secondGuideManual')}
                    </label>
                  </div>
                </div>
                {values.drugiVodicCheck && (
                  <div>
                    <label className={labelClass}>{t('fields.secondGuideName')}</label>
                    <input value={values.drugiVodicIme} onChange={(e) => patch({ drugiVodicIme: e.target.value })} placeholder={t('placeholders.secondGuideName')} className={baseInput} />
                  </div>
                )}
              </>
            )}

            {!isVia && (
              <div>
                <label className={labelClass}>{t('fields.actionImage')}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
                />
                {initialImageUrl && !image && <p className="mt-1 text-[11px] text-gray-500">{t('wizard.image.currentAlreadySet')}</p>}
                {imageHelpText && <p className="mt-1 text-[11px] text-gray-400">{imageHelpText}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <p className="text-xs text-gray-500">
            {t('wizard.step2.amountsInCurrency')}{' '}
            <span className="font-semibold text-gray-800">{cur}</span>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {!isVia && (
              <div>
                <label className={labelClass}>{t('wizard.labels.departurePlace')}</label>
                <input required value={values.mestoPolaska} onChange={(e) => patch({ mestoPolaska: e.target.value })} className={baseInput} />
              </div>
            )}
            <div className={!isVia ? '' : 'sm:col-span-2'}>
              <label className={labelClass}>{t('wizard.labels.contactPhone')}</label>
              <input
                required={!isVia}
                value={values.kontaktTelefon}
                onChange={(e) => patch({ kontaktTelefon: e.target.value })}
                placeholder={isVia ? t('wizard.ferrata.contactPhoneOptionalPlaceholder') : undefined}
                className={baseInput}
              />
              {isVia && <p className="mt-1 text-[11px] text-gray-500">{t('wizard.ferrata.contactPhoneOptionalHint')}</p>}
            </div>
            {!isVia && (
              <div>
                <label className={labelClass}>{t('wizard.labels.numberOfDays')}</label>
                <input type="number" min="1" step="1" value={values.brojDana} onChange={(e) => patch({ brojDana: e.target.value })} className={baseInput} />
              </div>
            )}
            {isVia ? (
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('wizard.labels.price', { currency: cur })}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.cenaClan}
                  onChange={(e) => {
                    const v = e.target.value
                    patch({ cenaClan: v, cenaOstali: v })
                  }}
                  className={baseInput}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className={labelClass}>{t('wizard.labels.memberPrice', { currency: cur })}</label>
                  <input type="number" min="0" step="0.01" value={values.cenaClan} onChange={(e) => patch({ cenaClan: e.target.value })} className={baseInput} />
                </div>
                {isPublic && (
                  <div>
                    <label className={labelClass}>{t('wizard.labels.othersPrice', { currency: cur })}</label>
                    <input type="number" min="0" step="0.01" value={values.cenaOstali} onChange={(e) => patch({ cenaOstali: e.target.value })} className={baseInput} />
                  </div>
                )}
              </>
            )}
          </div>

          {!isVia && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">{t('wizard.step2.lodging.title')}</h3>
                <button
                  type="button"
                  onClick={addSmestaj}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 transition-all hover:bg-emerald-100 active:scale-[0.97]"
                >
                  {t('wizard.step2.lodging.add')}
                </button>
              </div>
              {!showSmestaj && <p className="text-xs text-gray-500">{t('wizard.step2.lodging.optionalHint')}</p>}
              {values.smestaj.map((s) => (
                <div key={s.localId} className="grid gap-3 sm:grid-cols-4 p-3 rounded-xl border border-gray-100 bg-gray-50/60">
                  <input placeholder={t('wizard.step2.lodging.whereToSleepPlaceholder')} value={s.naziv} onChange={(e) => patch({ smestaj: values.smestaj.map((it) => (it.localId === s.localId ? { ...it, naziv: e.target.value } : it)) })} className={baseInput} />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t('wizard.step2.lodging.totalPerPersonPlaceholder', { currency: cur })}
                    value={s.cenaPoOsobiUkupno}
                    onChange={(e) => patch({ smestaj: values.smestaj.map((it) => (it.localId === s.localId ? { ...it, cenaPoOsobiUkupno: e.target.value } : it)) })}
                    className={baseInput}
                  />
                  <input placeholder={t('wizard.step2.lodging.descriptionPlaceholder')} value={s.opis} onChange={(e) => patch({ smestaj: values.smestaj.map((it) => (it.localId === s.localId ? { ...it, opis: e.target.value } : it)) })} className={`${baseInput} sm:col-span-2`} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 3 && !isVia && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            {t('wizard.step3.rentalPricesIn')}{' '}
            <span className="font-semibold text-gray-800">{cur}</span>
          </p>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">{t('wizard.step3.equipment.title')}</h3>
            <button
              type="button"
              onClick={addOprema}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 transition-all hover:bg-emerald-100 active:scale-[0.97]"
            >
              {t('wizard.step3.equipment.add')}
            </button>
          </div>
          {values.oprema.length === 0 && <p className="text-xs text-gray-500">{t('wizard.step3.equipment.emptyHint')}</p>}
          {values.oprema.map((o) => (
            <div key={o.localId} className="grid gap-3 sm:grid-cols-4 p-3 rounded-xl border border-gray-100 bg-gray-50/60">
              <input placeholder={t('wizard.step3.equipment.namePlaceholder')} value={o.naziv} onChange={(e) => patch({ oprema: values.oprema.map((it) => (it.localId === o.localId ? { ...it, naziv: e.target.value } : it)) })} className={`${baseInput} sm:col-span-2`} />
              <input type="number" min="0" step="1" placeholder={t('wizard.step3.equipment.rentQtyPlaceholder')} value={o.dostupnaKolicina} onChange={(e) => patch({ oprema: values.oprema.map((it) => (it.localId === o.localId ? { ...it, dostupnaKolicina: e.target.value } : it)) })} className={baseInput} />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={t('wizard.step3.equipment.perSetPricePlaceholder', { currency: cur })}
                value={o.cenaPoSetu}
                onChange={(e) => patch({ oprema: values.oprema.map((it) => (it.localId === o.localId ? { ...it, cenaPoSetu: e.target.value } : it)) })}
                className={baseInput}
              />
            </div>
          ))}
        </div>
      )}

      {((step === 3 && isVia) || (step === 4 && !isVia)) && (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-2 text-sm text-gray-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('wizard.step4.reviewBeforeSubmit')}</p>
            <p>
              <span className="text-gray-500">{t('wizard.step4.summary.action')}</span> {values.naziv || '—'} · {values.planina || '—'} — {values.vrh || '—'}
            </p>
            <p>
              <span className="text-gray-500">{t('wizard.step4.summary.date')}</span> {values.datum || '—'} · <span className="text-gray-500">{t('wizard.step4.summary.difficulty')}</span> {values.tezina || '—'}
            </p>
            <p>
              <span className="text-gray-500">{t('wizard.labels.organizer')}</span> {organizerLabel} ·{' '}
              <span className="text-gray-500">{t('wizard.step4.summary.visibility')}</span> {visibilityLabel} · <span className="text-gray-500">{t('wizard.step4.summary.currency')}</span>{' '}
              <span className="font-semibold text-emerald-800">{cur}</span>
            </p>
          </div>
          {step === 4 && !isVia && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">{t('wizard.step4.transport.title')}</h3>
                <button
                  type="button"
                  onClick={addPrevoz}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 transition-all hover:bg-emerald-100 active:scale-[0.97]"
                >
                  {t('wizard.step4.transport.add')}
                </button>
              </div>
              {values.prevoz.map((p) => (
                <div key={p.localId} className="grid gap-3 sm:grid-cols-4 p-3 rounded-xl border border-gray-100 bg-gray-50/60">
                  <input placeholder={t('wizard.step4.transport.typePlaceholder')} value={p.tipPrevoza} onChange={(e) => patch({ prevoz: values.prevoz.map((it) => (it.localId === p.localId ? { ...it, tipPrevoza: e.target.value } : it)) })} className={baseInput} />
                  <input placeholder={t('wizard.step4.transport.groupPlaceholder')} value={p.nazivGrupe} onChange={(e) => patch({ prevoz: values.prevoz.map((it) => (it.localId === p.localId ? { ...it, nazivGrupe: e.target.value } : it)) })} className={baseInput} />
                  <input type="number" min="0" step="1" placeholder={t('wizard.step4.transport.capacityPlaceholder')} value={p.kapacitet} onChange={(e) => patch({ prevoz: values.prevoz.map((it) => (it.localId === p.localId ? { ...it, kapacitet: e.target.value } : it)) })} className={baseInput} />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t('wizard.step4.transport.pricePerPersonPlaceholder', { currency: cur })}
                    value={p.cenaPoOsobi}
                    onChange={(e) => patch({ prevoz: values.prevoz.map((it) => (it.localId === p.localId ? { ...it, cenaPoOsobi: e.target.value } : it)) })}
                    className={baseInput}
                  />
                </div>
              ))}
            </>
          )}

          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={values.prikaziListuPrijavljenih} onChange={(e) => patch({ prikaziListuPrijavljenih: e.target.checked })} />
              {t('wizard.step4.options.showRegisteredList')}
            </label>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-gray-700">
            <p className="font-semibold text-emerald-700 mb-1">{t('wizard.step4.costPreview.title', { currency: cur })}</p>
            {isVia ? (
              <p>
                {t('wizard.step4.costPreview.base')}{' '}
                <span className="font-semibold">
                  {Number(values.cenaClan || 0).toFixed(2)} {cur}
                </span>
              </p>
            ) : (
              <>
                <p>
                  {t('wizard.step4.costPreview.memberBase')}{' '}
                  <span className="font-semibold">
                    {Number(values.cenaClan || 0).toFixed(2)} {cur}
                  </span>
                </p>
                {isPublic && (
                  <p>
                    {t('wizard.step4.costPreview.othersBase')}{' '}
                    <span className="font-semibold">
                      {Number(values.cenaOstali || 0).toFixed(2)} {cur}
                    </span>
                  </p>
                )}
              </>
            )}
            <p>
              {t('wizard.step4.costPreview.optionalAddons')}{' '}
              <span className="font-semibold">
                {totalOptionalPreview.toFixed(2)} {cur}
              </span>
            </p>
          </div>
        </div>
      )}

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
