/** Action wizard shared types (web + mobile) */

export interface WizardGuide {
  id: number
  username: string
  fullName: string
  isProfiGuide?: boolean
  source?: 'club' | 'profi'
}

export type ActionKind = 'planina' | 'via_ferrata'
export type VisibilityKind = 'klubska' | 'javna'
export type OrganizerKind = 'klub' | 'vodic'
export type ClubCurrencyCode = 'RSD' | 'EUR' | 'BAM' | 'HRK' | 'MKD' | 'ALL' | string

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

export type WizardImagePayload =
  | File
  | { uri: string; name: string; type: string }
  | null
