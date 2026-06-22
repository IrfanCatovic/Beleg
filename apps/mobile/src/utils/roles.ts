import type { SessionUser } from '@beleg/shared'

export function canSeeFinance(role?: string): boolean {
  return role === 'superadmin' || role === 'admin' || role === 'blagajnik'
}

export function canManageActions(role?: string): boolean {
  return role === 'superadmin' || role === 'admin' || role === 'vodic'
}

export function canManageClub(user: SessionUser | null, clubId: number | undefined): boolean {
  if (!user) return false
  if (user.role === 'superadmin') return true
  if (clubId == null) return false
  if (user.klubId !== clubId) return false
  return user.role === 'admin' || user.role === 'sekretar'
}

export function hasClubContext(
  user: SessionUser | null,
  superadminClubId?: string | null,
): boolean {
  if (!user) return false
  if (user.role === 'superadmin') return !!superadminClubId
  return typeof user.klubId === 'number'
}
