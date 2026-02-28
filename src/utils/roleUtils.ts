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
  admin: 'bg-red-600 text-white dark:bg-red-700 dark:text-white',

  clan: 'bg-blue-600 text-white dark:bg-blue-700 dark:text-white',

  vodic: 'bg-orange-600 text-white dark:bg-orange-700 dark:text-white',

  blagajnik: 'bg-emerald-600 text-white dark:bg-emerald-700 dark:text-white',

  sekretar: 'bg-yellow-500 text-black dark:bg-yellow-600 dark:text-black',

  'menadzer-opreme': 'bg-slate-600 text-white dark:bg-slate-700 dark:text-white',
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

export function getRoleStyle(role: string): string {
  return ROLE_STYLES[role] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
}
