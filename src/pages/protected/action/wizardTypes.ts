import type { ClubCurrencyCode } from '../../../utils/clubCurrency'

export type ActionKind = 'planina' | 'via_ferrata'
export type VisibilityKind = 'klubska' | 'javna'
export type OrganizerKind = 'klub' | 'vodic'

export interface WizardGuide {
  id: number
  username: string
  fullName: string
  isProfiGuide?: boolean
  source?: 'club' | 'profi'
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
  planinaLat: string
  planinaLng: string
  smestaj: WizardSmestaj[]
  oprema: WizardOprema[]
  prevoz: WizardPrevoz[]
}

export interface ActionWizardFormProps {
  title: string
  badge: string
  submitText: string
  submitLoadingText: string
  guides: WizardGuide[]
  initialValues: WizardValues
  initialImageUrl?: string
  clubCurrency: ClubCurrencyCode
  loading: boolean
  error: string
  success: string
  minDate?: string
  imageHelpText?: string
  lockActionKind?: boolean
  ferrataCatalog?: WizardFerrataOption[]
  lockFerrataSelection?: boolean
  lockOrganizerType?: boolean
  onSubmit: (values: WizardValues, image: File | null) => void | Promise<void>
}

export const wizardBaseInput =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 outline-none transition'

export const wizardLabelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-[0.16em]'

const navBtnBase =
  'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 active:scale-[0.97]'

export const wizardNavBtnSecondary =
  `${navBtnBase} border border-gray-200 text-gray-600 bg-white hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-800 disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100`

export const wizardNavBtnPrimary =
  `${navBtnBase} border border-emerald-300 text-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 hover:border-emerald-400 hover:shadow-md`

export const wizardNavBtnSubmit =
  `${navBtnBase} text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 hover:shadow-md disabled:opacity-60 disabled:cursor-wait disabled:active:scale-100`
