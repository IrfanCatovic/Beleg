/**
 * Planiner paleta — usklađeno sa web AppLayout:
 * tamni slate chrome (header/tab bar) + emerald/teal akcenti na akcijama.
 */
export const colors = {
  brand: '#059669', // emerald-600 — primarni CTA
  brandLight: '#10b981', // emerald-500
  brandDark: '#047857', // emerald-700
  accent: '#0d9488', // teal-600
  accentLight: '#14b8a6', // teal-500

  navBg: '#0f172a', // slate-900
  navBgMid: '#1e293b', // slate-800
  navBorder: 'rgba(255,255,255,0.06)',

  bg: '#f9fafb', // gray-50
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9', // slate-100

  border: '#e2e8f0', // slate-200
  borderStrong: '#cbd5e1', // slate-300

  text: '#0f172a', // slate-900
  textMuted: '#64748b', // slate-500
  textSubtle: '#94a3b8', // slate-400
  textOnDark: '#ffffff',
  textOnDarkMuted: 'rgba(255,255,255,0.7)',
  textOnDarkSubtle: 'rgba(255,255,255,0.45)',

  danger: '#dc2626',
  dangerBg: '#fef2f2',
  warning: '#d97706',
  warningBg: '#fffbeb',
  success: '#059669',
  rose: '#f43f5e', // badge unread

  white: '#ffffff',
  black: '#000000',
  overlay: 'rgba(15, 23, 42, 0.5)',
} as const

export type AppColors = typeof colors
