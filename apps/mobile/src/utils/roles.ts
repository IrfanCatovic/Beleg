import type { SessionUser } from '@beleg/shared'

export function canSeeFinance(role?: string): boolean {
  return role === 'superadmin' || role === 'admin' || role === 'blagajnik'
}

export function canManageActions(role?: string): boolean {
  return role === 'superadmin' || role === 'admin' || role === 'vodic'
}

export function canManageClub(user: SessionUser | null, clubId: number | undefined): boolean {
  if (!user || clubId == null) return false
  if (user.role === 'superadmin') return true
  if (user.klubId !== clubId) return false
  return user.role === 'admin' || user.role === 'sekretar'
}

export function hasClubContext(user: SessionUser | null): boolean {
  return !!user && (user.role === 'superadmin' || typeof user.klubId === 'number')
}
