import type { AxiosInstance } from 'axios'
import type { WizardGuide } from '../types/actionWizard'
import { fetchKorisnici } from './users'
import { listGuidesCatalog } from './catalog'
import { buildWizardGuidesFromCatalog } from '../utils/wizardGuideDistance'

export async function loadActionFormGuides(client: AxiosInstance): Promise<WizardGuide[]> {
  const [korisnici, profiRows] = await Promise.all([
    fetchKorisnici(client),
    listGuidesCatalog(client, { limit: 200 }),
  ])

  const clubVodici = korisnici.filter((k) => k.role === 'vodic')
  return buildWizardGuidesFromCatalog(clubVodici, profiRows)
}
