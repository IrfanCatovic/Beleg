import type { SessionUser } from '@beleg/shared'

export function canSeeFinance(role?: string): boolean {
  return role === 'superadmin' || role === 'admin' || role === 'blagajnik'
}

export function canManageActions(role?: string): boolean {
  return role === 'superadmin' || role === 'admin' || role === 'vodic'
}

export function canManageClub(role?: string): boolean {
  return role === 'superadmin' || role === 'admin' || role === 'sekretar'
}

export function hasClubContext(user: SessionUser | null): boolean {
  return !!user && (user.role === 'superadmin' || typeof user.klubId === 'number')
}
