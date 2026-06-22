import { SUPERADMIN_CLUB_ID_KEY, SUPERADMIN_CLUB_NAME_KEY } from '@beleg/shared'
import { mobileStorage } from '../storage/mobileStorage'

export async function clearSuperadminClubStorage(): Promise<void> {
  await mobileStorage.removeItem(SUPERADMIN_CLUB_ID_KEY)
  await mobileStorage.removeItem(SUPERADMIN_CLUB_NAME_KEY)
}

export async function loadSuperadminClubFromStorage(): Promise<{
  clubId: string | null
  clubName: string | null
}> {
  const [clubId, clubName] = await Promise.all([
    mobileStorage.getItem(SUPERADMIN_CLUB_ID_KEY),
    mobileStorage.getItem(SUPERADMIN_CLUB_NAME_KEY),
  ])
  return { clubId, clubName }
}

export async function saveSuperadminClubToStorage(id: number, name: string): Promise<void> {
  await mobileStorage.setItem(SUPERADMIN_CLUB_ID_KEY, String(id))
  await mobileStorage.setItem(SUPERADMIN_CLUB_NAME_KEY, name)
}
