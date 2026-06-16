import api from './api'
import type { WizardGuide } from '../types/actionWizard'
import { listGuidesCatalog } from './guidesPublic'

export async function loadActionFormGuides(): Promise<WizardGuide[]> {
  const [korisniciRes, profiRows] = await Promise.all([
    api.get<{ korisnici?: Array<{ id: number; username: string; fullName?: string; role: string }> }>('/api/korisnici'),
    listGuidesCatalog({ limit: 200 }),
  ])

  const clubVodici = (korisniciRes.data.korisnici ?? []).filter((k) => k.role === 'vodic')
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
