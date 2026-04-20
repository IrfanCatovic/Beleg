/** Ista logika kao u AppLayout: članstvo u klubu, ili superadmin (koji u ovom flow-u radi sa izabranim klubom). */
export function userHasClubContext(user: { role: string; klubId?: number } | null | undefined): boolean {
  if (!user) return false
  if (user.role === 'superadmin') return true
  return user.klubId != null && Number(user.klubId) !== 0
}
