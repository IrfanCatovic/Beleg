/** Uspešna akcija na profilu korisnika */

export interface UspesnaAkcija {
  id: number
  naziv: string
  tipAkcije?: 'planina' | 'via_ferrata'
  planina?: string
  vrh: string
  datum: string
  opis?: string
  tezina?: string
  slikaUrl?: string
  createdAt: string
  updatedAt: string
  duzinaStazeKm?: number
  kumulativniUsponM?: number
  visinaVrhM?: number
  zimskiUspon?: boolean
}

export interface KorisnikStatistika {
  ukupnoKm: number
  ukupnoMetaraUspona: number
  brojPopeoSe: number
  /** Ukupno koraka iz dnevnog praćenja */
  ukupnoKoraka?: number
}
