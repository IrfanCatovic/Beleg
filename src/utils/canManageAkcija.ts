import type { User } from '../context/AuthContext'

/** Samo admin/vodič/superadmin kluba koji je kreirao akciju (domaćin) može da je uređuje. */
export function canManageHostAkcija(
  user: User | null,
  akcijaKlubId: number | undefined | null
): boolean {
  if (!user || akcijaKlubId == null || akcijaKlubId === 0) return false
  if (!['admin', 'vodic', 'superadmin'].includes(user.role)) return false
  if (user.role === 'superadmin') {
    const sid = localStorage.getItem('superadmin_club_id')
    if (!sid) return false
    return Number(sid) === Number(akcijaKlubId)
  }
  const uid = user.klubId
  if (uid == null) return false
  return Number(uid) === Number(akcijaKlubId)
}
