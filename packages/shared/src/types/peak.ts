/** Vrh/planina — usklađeno sa backend/internal/models/peak.go */

export interface PeakRow {
  id: number
  naziv: string
  planina?: string
  visinaM?: number
  lat?: number
  lng?: number
  [key: string]: unknown
}
