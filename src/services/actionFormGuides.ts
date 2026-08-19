import api from './api'
import type { WizardGuide } from '../types/actionWizard'
import { listGuidesCatalog } from './guidesPublic'
import { buildWizardGuidesFromCatalog } from '@beleg/shared'

export async function loadActionFormGuides(): Promise<WizardGuide[]> {
  const [korisniciRes, profiRows] = await Promise.all([
    api.get<{ korisnici?: Array<{ id: number; username: string; fullName?: string; role: string }> }>('/api/korisnici'),
    listGuidesCatalog({ limit: 200 }),
  ])

  const clubVodici = (korisniciRes.data.korisnici ?? []).filter((k) => k.role === 'vodic')
  return buildWizardGuidesFromCatalog(clubVodici, profiRows)
}
