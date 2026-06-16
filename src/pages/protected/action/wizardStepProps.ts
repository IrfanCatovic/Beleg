import type { TFunction } from 'i18next'
import type { ClubCurrencyCode } from '../../../utils/clubCurrency'
import type {
  ActionKind,
  OrganizerKind,
  VisibilityKind,
  WizardFerrataOption,
  WizardGuide,
  WizardValues,
} from './wizardTypes'

export interface WizardStepProps {
  values: WizardValues
  patch: (partial: Partial<WizardValues>) => void
  setValues: React.Dispatch<React.SetStateAction<WizardValues>>
  setStep: React.Dispatch<React.SetStateAction<number>>
  setImage: React.Dispatch<React.SetStateAction<File | null>>
  image: File | null
  setGeoErr: React.Dispatch<React.SetStateAction<string>>
  t: TFunction
  tFr: TFunction
  baseInput: string
  labelClass: string
  clubCurrency: ClubCurrencyCode
  isVia: boolean
  isGuideOrganizer: boolean
  isPublic: boolean
  lockActionKind?: boolean
  lockFerrataSelection?: boolean
  lockOrganizerType?: boolean
  ferrataCatalog: WizardFerrataOption[]
  selectedFerrata?: WizardFerrataOption
  selectedGuideLabel: string
  guideDropdownOptions: { value: string; label: string; disabled?: boolean }[]
  guides: WizardGuide[]
  minDate?: string
  initialImageUrl?: string
  imageHelpText?: string
  geoQuery: string
  setGeoQuery: React.Dispatch<React.SetStateAction<string>>
  geoBusy: boolean
  geoErr: string
  runGeocode: () => Promise<void>
  organizerLabel: string
  visibilityLabel: string
  showSmestaj: boolean
  addSmestaj: () => void
  addOprema: () => void
  addPrevoz: () => void
  hintCenterForMountain: { lat: number; lng: number } | null
  totalOptionalPreview: number
  showTransport: boolean
}

export type { ActionKind, OrganizerKind, VisibilityKind }
