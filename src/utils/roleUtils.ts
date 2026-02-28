export type RoleType = 'admin' | 'clan' | 'vodic' | 'blagajnik' | 'sekretar' | 'menadzer-opreme'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  clan: 'Član',
  vodic: 'Vodič',
  blagajnik: 'Blagajnik',
  sekretar: 'Sekretar',
  'menadzer-opreme': 'Menadžer opreme',
}

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  clan: 'bg-blue-100 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
  vodic: 'bg-orange-100 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200',
  blagajnik: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
  sekretar: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200',
  'menadzer-opreme': 'bg-slate-200 text-slate-900 dark:bg-slate-800/60 dark:text-slate-200',
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

export function getRoleStyle(role: string): string {
  return ROLE_STYLES[role] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
}
