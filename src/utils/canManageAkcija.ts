import type { User } from '../context/AuthContext'

export type AkcijaManageContext = {
  klubId?: number | null
  organizatorTip?: string | null
  vodicId?: number | null
  vodicUsername?: string | null
}

/** Admin/vodič kluba (domaćin) ili vodič koji vodi nezavisnu turu. */
export function canManageHostAkcija(user: User | null, akcija: AkcijaManageContext): boolean {
  const org = (akcija.organizatorTip ?? 'klub').toLowerCase()
  let result = false
  let blockReason = 'unknown'

  if (!user) {
    blockReason = 'no_user'
  } else if (!['admin', 'vodic', 'superadmin'].includes(user.role)) {
    blockReason = 'role_not_allowed'
  } else if (org === 'vodic' && (akcija.vodicId || akcija.vodicUsername)) {
    if (akcija.vodicUsername && user.username) {
      result = akcija.vodicUsername === user.username
      blockReason = result ? 'vodic_username_match' : 'vodic_username_mismatch'
    } else {
      blockReason = 'vodic_username_missing'
    }
  } else {
    const akcijaKlubId = akcija.klubId
    if (akcijaKlubId == null || akcijaKlubId === 0) {
      blockReason = 'no_klub_id'
    } else if (user.role === 'superadmin') {
      const sid = localStorage.getItem('superadmin_club_id')
      if (!sid) {
        blockReason = 'superadmin_no_club'
      } else {
        result = Number(sid) === Number(akcijaKlubId)
        blockReason = result ? 'superadmin_club_match' : 'superadmin_club_mismatch'
      }
    } else {
      const uid = user.klubId
      if (uid == null) {
        blockReason = 'user_no_klub'
      } else {
        result = Number(uid) === Number(akcijaKlubId)
        blockReason = result ? 'club_match' : 'club_mismatch'
      }
    }
  }

  // #region agent log
  fetch('http://127.0.0.1:7774/ingest/4b4823e8-e059-45d4-bd4e-f7b6e10474eb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '0764c5' },
    body: JSON.stringify({
      sessionId: '0764c5',
      location: 'canManageAkcija.ts:canManageHostAkcija',
      message: 'canManageHostAkcija evaluated',
      hypothesisId: 'A-B-C',
      data: {
        result,
        blockReason,
        userRole: user?.role ?? null,
        userUsername: user?.username ?? null,
        userKlubId: user?.klubId ?? null,
        organizatorTip: org,
        akcijaKlubId: akcija.klubId ?? null,
        vodicId: akcija.vodicId ?? null,
        vodicUsername: akcija.vodicUsername ?? null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  return result
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
