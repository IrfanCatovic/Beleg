import type { User } from '../context/AuthContext'

export type AkcijaManageContext = {
  klubId?: number | null
  organizatorTip?: string | null
  vodicId?: number | null
  vodicUsername?: string | null
  addedByUsername?: string | null
}

function isActionLeader(user: User, akcija: AkcijaManageContext): boolean {
  if (!user.username) return false
  if (akcija.vodicUsername && user.username === akcija.vodicUsername) return true
  if (akcija.addedByUsername && user.username === akcija.addedByUsername) return true
  return false
}

/** Vođa/kreator akcije (npr. profi vodič sa ulogom clan) ili admin/vodič kluba domaćina. */
export function canManageHostAkcija(user: User | null, akcija: AkcijaManageContext): boolean {
  let result = false
  let blockReason = 'unknown'

  if (!user) {
    blockReason = 'no_user'
  } else if (isActionLeader(user, akcija)) {
    result = true
    blockReason = 'action_leader'
  } else if (!['admin', 'vodic', 'superadmin'].includes(user.role)) {
    blockReason = 'role_not_allowed'
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
      hypothesisId: 'A',
      data: {
        result,
        blockReason,
        userRole: user?.role ?? null,
        userUsername: user?.username ?? null,
        userKlubId: user?.klubId ?? null,
        organizatorTip: akcija.organizatorTip ?? null,
        akcijaKlubId: akcija.klubId ?? null,
        vodicId: akcija.vodicId ?? null,
        vodicUsername: akcija.vodicUsername ?? null,
        addedByUsername: akcija.addedByUsername ?? null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  return result
}

/** Ko može odobriti zahtev za prijavu: vodič akcije, kreator, ili admin/sekretar kluba ako nema vodiča. */
export function canApproveSignupRequest(user: User | null, akcija: AkcijaManageContext): boolean {
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
