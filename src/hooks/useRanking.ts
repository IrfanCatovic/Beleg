import { useMemo } from 'react'
import {
  computeRank,
  mapAkcijaToTura,
  type RankResult,
  type AkcijaZaRanking,
  type Tura,
} from '../utils/rankingUtils'

export interface StatistikaZaRanking {
  /** Niz tura (ako već imaš mapirane) */
  ture?: Tura[]
  /** Niz akcija iz API-ja (npr. uspesneAkcije) – mapira se u ture ako nema ture */
  uspesneAkcije?: AkcijaZaRanking[]
  ukupnoKm?: number
  ukupnoMetaraUspona?: number
}

/**
 * Hook: iz statistike (ture ili uspesneAkcije + ukupnoKm/ukupnoMetaraUspona) računa MMR i rank.
 * Vraća { naziv, boja, mmr, segment, glavniRank }.
 */
export function useRanking(statistika: StatistikaZaRanking | null | undefined): RankResult {
  return useMemo(() => {
    if (!statistika) {
      return {
        naziv: 'Početnik I',
        boja: '#ccc4b1',
        mmr: 0,
        segment: 1,
        glavniRank: 1,
      }
    }
    const ture =
      statistika.ture ??
      (statistika.uspesneAkcije?.map(mapAkcijaToTura) ?? [])
    return computeRank({
      ture,
      ukupnoKm: statistika.ukupnoKm,
      ukupnoMetaraUspona: statistika.ukupnoMetaraUspona,
    })
  }, [
    statistika?.ture,
    statistika?.uspesneAkcije,
    statistika?.ukupnoKm,
    statistika?.ukupnoMetaraUspona,
  ])
}
