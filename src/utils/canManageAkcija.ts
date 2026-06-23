import type { User } from '../context/AuthContext'

export type AkcijaManageContext = {
  klubId?: number | null
  organizatorTip?: string | null
  vodicId?: number | null
  vodicUsername?: string | null
}

/** Admin/vodič kluba (domaćin) ili vodič koji vodi nezavisnu turu. */
export function canManageHostAkcija(user: User | null, akcija: AkcijaManageContext): boolean {
  if (!user || !['admin', 'vodic', 'superadmin'].includes(user.role)) return false

  const org = (akcija.organizatorTip ?? 'klub').toLowerCase()
  if (org === 'vodic' && (akcija.vodicId || akcija.vodicUsername)) {
    if (akcija.vodicUsername && user.username) {
      return akcija.vodicUsername === user.username
    }
    return false
  }

  const akcijaKlubId = akcija.klubId
  if (akcijaKlubId == null || akcijaKlubId === 0) return false

  if (user.role === 'superadmin') {
    const sid = localStorage.getItem('superadmin_club_id')
    if (!sid) return false
    return Number(sid) === Number(akcijaKlubId)
  }
  const uid = user.klubId
  if (uid == null) return false
  return Number(uid) === Number(akcijaKlubId)
}

/** Ko može odobriti zahtev za prijavu: vodič akcije ili admin/sekretar kluba ako nema vodiča. */
export function canApproveSignupRequest(user: User | null, akcija: AkcijaManageContext): boolean {
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
