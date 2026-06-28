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
  /** Niz akcija iz API-ja (npr. uspesneAkcije)  mapira se u ture ako nema ture */
  uspesneAkcije?: AkcijaZaRanking[]
  ukupnoKm?: number
  ukupnoMetaraUspona?: number
}

/**
 * Hook: iz statistike (ture ili uspesneAkcije + ukupnoKm/ukupnoMetaraUspona) računa PER i rank.
 * Vraća { naziv, boja, per, segment, glavniRank }.
 */
export function useRanking(statistika: StatistikaZaRanking | null | undefined): RankResult {
  return useMemo(() => {
    if (!statistika) {
      return {
        naziv: 'Početnik I',
        boja: '#ccc4b1',
        per: 0,
        segment: 1,
        glavniRank: 1,
      }
    }
    const ture =
      statistika.ture ??
      (statistika.uspesneAkcije?.map(mapAkcijaToTura) ?? [])
    const result = computeRank({
      ture,
      ukupnoKm: statistika.ukupnoKm,
      ukupnoMetaraUspona: statistika.ukupnoMetaraUspona,
    })
    // #region agent log
    fetch('http://127.0.0.1:7774/ingest/4b4823e8-e059-45d4-bd4e-f7b6e10474eb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'22881b'},body:JSON.stringify({sessionId:'22881b',location:'useRanking.ts',message:'hook rank',data:{tureCount:ture.length,uspesneCount:statistika.uspesneAkcije?.length??0,per:result.per},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return result
  }, [
    statistika?.ture,
    statistika?.uspesneAkcije,
    statistika?.uspesneAkcije?.length,
    statistika?.ukupnoKm,
    statistika?.ukupnoMetaraUspona,
  ])
}
