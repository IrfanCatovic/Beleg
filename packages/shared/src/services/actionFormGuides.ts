import type { AxiosInstance } from 'axios'
import type { WizardGuide } from '../types/actionWizard'
import { fetchKorisnici } from './users'
import { listGuidesCatalog } from './catalog'

export async function loadActionFormGuides(client: AxiosInstance): Promise<WizardGuide[]> {
  const [korisnici, profiRows] = await Promise.all([
    fetchKorisnici(client),
    listGuidesCatalog(client, { limit: 200 }),
  ])

  const clubVodici = korisnici.filter((k) => k.role === 'vodic')
  const clubIds = new Set(clubVodici.map((v) => v.id))

  const guides: WizardGuide[] = clubVodici.map((v) => ({
    id: v.id,
    username: v.username,
    fullName: (v.fullName || v.username).trim(),
    isProfiGuide: false,
    source: 'club' as const,
  }))

  for (const row of profiRows) {
    const uid = row.user?.id
    if (!uid || clubIds.has(uid)) continue
    guides.push({
      id: uid,
      username: row.user!.username,
      fullName: (row.user!.fullName || row.user!.username).trim(),
      isProfiGuide: true,
      source: 'profi' as const,
    })
  }

  return guides
}
