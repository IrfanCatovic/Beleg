import type { SessionUser } from '@beleg/shared'

export type AkcijaManageContext = {
  klubId?: number | null
  organizatorTip?: string | null
  vodicId?: number | null
  vodicUsername?: string | null
}

export function canManageHostAkcija(user: SessionUser | null, akcija: AkcijaManageContext): boolean {
  if (!user || !['admin', 'vodic', 'superadmin'].includes(user.role ?? '')) return false

  const org = (akcija.organizatorTip ?? 'klub').toLowerCase()
  if (org === 'vodic' && (akcija.vodicId || akcija.vodicUsername)) {
    if (akcija.vodicUsername && user.username) {
      return akcija.vodicUsername === user.username
    }
    return false
  }

  const akcijaKlubId = akcija.klubId
  if (akcijaKlubId == null || akcijaKlubId === 0) return false

  if (user.role === 'superadmin') return true

  const uid = user.klubId
  if (uid == null) return false
  return Number(uid) === Number(akcijaKlubId)
}

/** Ko može odobriti zahtev za prijavu: vodič akcije ili admin/sekretar kluba ako nema vodiča. */
export function canApproveSignupRequest(user: SessionUser | null, akcija: AkcijaManageContext): boolean {
  if (!user) return false
  if (user.role === 'superadmin') return true

  const hasGuide = !!(akcija.vodicId || akcija.vodicUsername)
  if (hasGuide) {
    if (akcija.vodicUsername && user.username) {
      return akcija.vodicUsername === user.username
    }
    return false
  }

  const akcijaKlubId = akcija.klubId
  if (akcijaKlubId == null || akcijaKlubId === 0) return false
  if (user.role !== 'admin' && user.role !== 'sekretar') return false

  const uid = user.klubId
  if (uid == null) return false
  return Number(uid) === Number(akcijaKlubId)
}
