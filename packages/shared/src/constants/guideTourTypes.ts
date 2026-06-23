export const GUIDE_TOUR_TYPE_KEYS = [
  'via_ferrata',
  'planinarska_tura',
  'uspon_na_vrh',
  'visokogorska_tura',
  'zimska_tura',
  'alpinisticka_tura',
  'visednevna_tura',
  'porodicna_tura',
  'privatna_tura',
  'edukativna_tura',
] as const

export type GuideTourTypeKey = (typeof GUIDE_TOUR_TYPE_KEYS)[number]

export const GUIDE_TOUR_TYPE_LABELS: Record<GuideTourTypeKey, string> = {
  via_ferrata: 'Via ferrata',
  planinarska_tura: 'Planinarska tura',
  uspon_na_vrh: 'Uspon na vrh',
  visokogorska_tura: 'Visokogorska tura',
  zimska_tura: 'Zimska tura',
  alpinisticka_tura: 'Alpinistička tura',
  visednevna_tura: 'Višednevna tura',
  porodicna_tura: 'Porodična tura',
  privatna_tura: 'Privatna tura',
  edukativna_tura: 'Edukativna tura',
}
