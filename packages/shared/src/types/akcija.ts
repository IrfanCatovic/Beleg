/** Zajednički tipovi za akcije — usklađeno sa backend/internal/models/akcija.go */

export type TipAkcije = 'planina' | 'via_ferrata'
export type OrganizatorTip = 'klub' | 'vodic'

export interface AkcijaVodicRef {
  fullName: string
  username: string
  isProfiGuide?: boolean
}

export interface AkcijaFerrataSnapshot {
  naziv?: string
  lokacija?: string
  tezina?: string
  tezina_opcija?: string
  duzina_m?: number
  visinska_razlika_m?: number
  trajanje_min?: number
  trajanje_max?: number
  obavezna_oprema?: string[]
  lat?: number
  lng?: number
}

export interface AkcijaSmestaj {
  id: number
  naziv: string
  cenaPoOsobiUkupno: number
  opis?: string
}

export interface AkcijaOprema {
  id: number
  naziv: string
  obavezna?: boolean
}

export interface AkcijaOpremaRent {
  id: number
  akcijaOpremaId?: number
  nazivOpreme: string
  dostupnaKolicina: number
  cenaPoSetu: number
}

export interface AkcijaPrevoz {
  id: number
  tipPrevoza: string
  nazivGrupe: string
  kapacitet: number
  cenaPoOsobi: number
}

/** Lista akcija (skraćen prikaz). */
export interface AkcijaListItem {
  id: number
  naziv: string
  tipAkcije?: TipAkcije
  planina?: string
  vrh: string
  datum: string
  opis?: string
  tezina?: string
  visinaVrhM?: number
  zimskiUspon?: boolean
  slikaUrl?: string
  isCompleted: boolean
  uIstorijiKluba?: boolean
  javna?: boolean
  organizatorTip?: OrganizatorTip
  klubNaziv?: string
  duzinaStazeKm?: number
  kumulativniUsponM?: number
  brojDana?: number
  createdAt?: string
  addedById?: number
  vodicId?: number
  klubLogoUrl?: string
}

/** Pun detalj akcije. */
export interface AkcijaDetail extends AkcijaListItem {
  createdAt?: string
  updatedAt?: string
  drugiVodicIme?: string
  vodicId?: number
  vodic?: AkcijaVodicRef
  addedBy?: AkcijaVodicRef
  prijaveCount?: number
  /** Statusi koji troše maxLjudi: prijavljen, popeo se, nije uspeo. */
  capacityUsedCount?: number
  klubId?: number
  limited?: boolean
  ferrataId?: number
  ferrataSnapshot?: AkcijaFerrataSnapshot
  startAt?: string
  trajanjeSati?: number
  rokPrijava?: string
  maxLjudi?: number
  mestoPolaska?: string
  kontaktTelefon?: string
  cenaClan?: number
  cenaOstali?: number
  prikaziListuPrijavljenih?: boolean
  omoguciGrupniChat?: boolean
  mojSaldo?: number
  isClanKluba?: boolean
  smestaj?: AkcijaSmestaj[]
  oprema?: AkcijaOprema[]
  opremaRent?: AkcijaOpremaRent[]
  prevoz?: AkcijaPrevoz[]
}

/** Alias za kompatibilnost sa postojećim kodom. */
export type Akcija = AkcijaDetail
