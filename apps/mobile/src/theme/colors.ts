/**
 * Paleta usklađena sa web app-om (emerald/teal brend + slate dark chrome).
 * Web koristi Tailwind default + brend zelenu #41ac53 i emerald-600.
 */
export const colors = {
  brand: '#41ac53',
  brandDark: '#2f8f43',
  emerald600: '#059669',
  emerald700: '#047857',
  teal600: '#0d9488',

  navBg: '#0f172a', // slate-900
  navBgAlt: '#1e293b', // slate-800

  bg: '#f8fafc', // slate-50
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9', // slate-100

  border: '#e2e8f0', // slate-200
  borderStrong: '#cbd5e1', // slate-300

  text: '#0f172a', // slate-900
  textMuted: '#64748b', // slate-500
  textSubtle: '#94a3b8', // slate-400
  textOnDark: '#ffffff',
  textOnDarkMuted: 'rgba(255,255,255,0.7)',

  danger: '#dc2626',
  dangerBg: '#fef2f2',
  warning: '#d97706',
  warningBg: '#fffbeb',
  success: '#16a34a',

  white: '#ffffff',
  black: '#000000',
  overlay: 'rgba(15, 23, 42, 0.5)',
} as const

export type AppColors = typeof colors
