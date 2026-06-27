import type { SessionUser } from '@beleg/shared'

export type AkcijaManageContext = {
  klubId?: number | null
  organizatorTip?: string | null
  vodicId?: number | null
  vodicUsername?: string | null
  addedByUsername?: string | null
}

function isActionLeader(user: SessionUser, akcija: AkcijaManageContext): boolean {
  if (!user.username) return false
  if (akcija.vodicUsername && user.username === akcija.vodicUsername) return true
  if (akcija.addedByUsername && user.username === akcija.addedByUsername) return true
  return false
}

export function canManageHostAkcija(user: SessionUser | null, akcija: AkcijaManageContext): boolean {
  if (!user) return false
  if (isActionLeader(user, akcija)) return true
  if (!['admin', 'vodic', 'superadmin'].includes(user.role ?? '')) return false

  const akcijaKlubId = akcija.klubId
  if (akcijaKlubId == null || akcijaKlubId === 0) return false

  if (user.role === 'superadmin') return true

  const uid = user.klubId
  if (uid == null) return false
  return Number(uid) === Number(akcijaKlubId)
}

/** Ko može odobriti zahtev za prijavu: vodič akcije, kreator, ili admin/sekretar kluba ako nema vodiča. */
export function canApproveSignupRequest(user: SessionUser | null, akcija: AkcijaManageContext): boolean {
  if (!user) return false
  if (user.role === 'superadmin') return true
  if (isActionLeader(user, akcija)) return true

  const hasGuide = !!(akcija.vodicId || akcija.vodicUsername)
  if (hasGuide) return false

  const akcijaKlubId = akcija.klubId
  if (akcijaKlubId == null || akcijaKlubId === 0) return false
  if (user.role !== 'admin' && user.role !== 'sekretar') return false

  const uid = user.klubId
  if (uid == null) return false
  return Number(uid) === Number(akcijaKlubId)
}
