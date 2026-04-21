import { useEffect, useMemo, useState } from 'react'
import Dropdown from '../../../components/Dropdown'
import CalendarDropdown from '../../../components/CalendarDropdown'
import type { ClubCurrencyCode } from '../../../utils/clubCurrency'
import { useTranslation } from 'react-i18next'

type ActionKind = 'planina' | 'via_ferrata'
type VisibilityKind = 'klubska' | 'javna'

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

export interface WizardValues {
  naziv: string
  actionKind: ActionKind
  visibility: VisibilityKind
  planina: string
  vrh: string
  datum: string
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
  onSubmit,
}: ActionWizardFormProps) {
  const { t } = useTranslation('actionForms')
  const [step, setStep] = useState(1)
  const [values, setValues] = useState<WizardValues>(initialValues)
  const [image, setImage] = useState<File | null>(null)

  useEffect(() => {
    setValues(initialValues)
  }, [initialValues])

  const isPublic = values.visibility === 'javna'
  const brojDana = Number(values.brojDana || '1')
  const showSmestaj = brojDana > 1

  const totalOptionalPreview = useMemo(() => {
    const sm = values.smestaj.reduce((acc, s) => acc + Number(s.cenaPoOsobiUkupno || 0), 0)
    const pr = values.prevoz.reduce((acc, p) => acc + Number(p.cenaPoOsobi || 0), 0)
    const op = values.oprema.reduce((acc, o) => acc + Number(o.cenaPoSetu || 0), 0)
    return sm + pr + op
  }, [values])

  const patch = (data: Partial<WizardValues>) => setValues((prev) => ({ ...prev, ...data }))
  const toStepLabel = (currentStep: number) => {
    if (currentStep === 1) return t('wizard.tabs.basic')
    if (currentStep === 2) return t('wizard.tabs.logistics')
    if (currentStep === 3) return t('wizard.tabs.equipment')
    return t('wizard.tabs.transportOptions')
  }
  const visibilityLabel = values.visibility === 'javna' ? t('wizard.visibility.public') : t('wizard.visibility.club')

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
    if (step < 4) return
    await onSubmit(values, image)
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
          {[1, 2, 3, 4].map((s) => (
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
                  onChange={(v) => patch({ actionKind: v as ActionKind })}
                  fullWidth
                />
              )}
            </div>
            <div>
              <label className={labelClass}>{t('wizard.labels.visibility')}</label>
              <Dropdown
                aria-label={t('wizard.aria.visibility')}
                options={[
                  { value: 'klubska', label: t('wizard.visibility.club') },
                  { value: 'javna', label: t('wizard.visibility.public') },
                ]}
                value={values.visibility}
                onChange={(v) => patch({ visibility: v as VisibilityKind })}
                fullWidth
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{t('fields.actionName')}</label>
              <input required value={values.naziv} onChange={(e) => patch({ naziv: e.target.value })} placeholder={t('placeholders.actionName')} className={baseInput} />
            </div>
            <div>
              <label className={labelClass}>{values.actionKind === 'planina' ? t('fields.mountain') : t('wizard.labels.viaFerrataLocation')}</label>
              <input required value={values.planina} onChange={(e) => patch({ planina: e.target.value })} placeholder={t('placeholders.mountain')} className={baseInput} />
            </div>
            <div>
              <label className={labelClass}>{values.actionKind === 'planina' ? t('fields.peak') : t('wizard.labels.viaFerrataName')}</label>
              <input required value={values.vrh} onChange={(e) => patch({ vrh: e.target.value })} placeholder={t('placeholders.peak')} className={baseInput} />
            </div>
            <div>
              <label className={labelClass}>{t('fields.actionDate')}</label>
              <CalendarDropdown aria-label={t('fields.actionDate')} value={values.datum} onChange={(v) => patch({ datum: v })} minDate={minDate} fullWidth />
            </div>
            <div>
              <label className={labelClass}>{t('fields.difficulty')}</label>
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
            </div>
            <div>
              <label className={labelClass}>{t('wizard.labels.durationHours')}</label>
              <input type="number" min="0.1" step="0.1" required value={values.trajanjeSati} onChange={(e) => patch({ trajanjeSati: e.target.value })} className={baseInput} />
            </div>
            <div>
              <label className={labelClass}>{t('wizard.labels.registrationDeadline')}</label>
              <CalendarDropdown aria-label={t('wizard.labels.registrationDeadline')} value={values.rokPrijava} onChange={(v) => patch({ rokPrijava: v })} fullWidth />
            </div>
            <div>
              <label className={labelClass}>{t('wizard.labels.maxPeople')}</label>
              <input type="number" min="0" step="1" value={values.maxLjudi} onChange={(e) => patch({ maxLjudi: e.target.value })} className={baseInput} />
            </div>
            <div>
              <label className={labelClass}>{t('fields.ascentM')}</label>
              <input type="number" min="0" step="1" required value={values.kumulativniUsponM} onChange={(e) => patch({ kumulativniUsponM: e.target.value })} placeholder={t('placeholders.ascentM')} className={baseInput} />
            </div>
            <div>
              <label className={labelClass}>{t('fields.trailLengthKm')}</label>
              <input type="number" min="0" step="0.1" required value={values.duzinaStazeKm} onChange={(e) => patch({ duzinaStazeKm: e.target.value })} placeholder={t('placeholders.lengthKm')} className={baseInput} />
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
          </div>
          <div>
            <label className={labelClass}>{t('fields.description')}</label>
            <textarea rows={4} value={values.opis} onChange={(e) => patch({ opis: e.target.value })} placeholder={t('placeholders.description')} className={`${baseInput} min-h-[90px]`} />
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-950">
            <span className="font-semibold">{t('wizard.currency.title')}</span> {cur}. {t('wizard.currency.help', { currency: cur })}
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-4">
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
            <div>
              <label className={labelClass}>{t('wizard.labels.departurePlace')}</label>
              <input required value={values.mestoPolaska} onChange={(e) => patch({ mestoPolaska: e.target.value })} className={baseInput} />
            </div>
            <div>
              <label className={labelClass}>{t('wizard.labels.contactPhone')}</label>
              <input required value={values.kontaktTelefon} onChange={(e) => patch({ kontaktTelefon: e.target.value })} className={baseInput} />
            </div>
            <div>
              <label className={labelClass}>{t('wizard.labels.numberOfDays')}</label>
              <input type="number" min="1" step="1" value={values.brojDana} onChange={(e) => patch({ brojDana: e.target.value })} className={baseInput} />
            </div>
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
          </div>

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
        </div>
      )}

      {step === 3 && (
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

      {step === 4 && (
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
              <span className="text-gray-500">{t('wizard.step4.summary.visibility')}</span> {visibilityLabel} · <span className="text-gray-500">{t('wizard.step4.summary.currency')}</span>{' '}
              <span className="font-semibold text-emerald-800">{cur}</span>
            </p>
          </div>
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

          <div className="grid gap-3 sm:grid-cols-2 border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={values.prikaziListuPrijavljenih} onChange={(e) => patch({ prikaziListuPrijavljenih: e.target.checked })} />
              {t('wizard.step4.options.showRegisteredList')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={values.omoguciGrupniChat} onChange={(e) => patch({ omoguciGrupniChat: e.target.checked })} />
              {t('wizard.step4.options.enableGroupChat')}
            </label>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-gray-700">
            <p className="font-semibold text-emerald-700 mb-1">{t('wizard.step4.costPreview.title', { currency: cur })}</p>
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
          {step < 4 && (
            <button type="button" onClick={() => setStep((s) => Math.min(4, s + 1))} className={navBtnPrimary}>
              {t('wizard.navigation.nextStep')}
            </button>
          )}
          {step === 4 && (
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
