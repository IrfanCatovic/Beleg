/** Pravila Faze A — Planinarski pasoš header (testabilno bez RN rendera). */

export const PASSPORT_PUBLIC_KPI_LABELS = ['OSVOJENO', 'KILOMETRI', 'USPON'] as const

/** Passport shortcut removed from owner profile — always false. */
export function shouldShowOwnerPassportShortcut(isMe: boolean, canOpenSettings: boolean): boolean {
  void isMe
  void canOpenSettings
  return false
}

export function shouldShowOwnerStepsCard(isMe: boolean): boolean {
  return isMe
}

/** Daily steps are not a public header KPI. */
export function isStepsPublicHeaderKpi(): boolean {
  return false
}

export function getOwnerPrimaryCtaLabel(canOpenSettings: boolean): string | null {
  return canOpenSettings ? 'Uredi profil' : null
}

export function getPublicPrimaryCtaLabel(opts: {
  isMe: boolean
  blockedByTarget: boolean
  followLabel: string
}): string | null {
  if (opts.isMe || opts.blockedByTarget) return null
  return opts.followLabel
}

export function buildProfileAccessibilityLabels(opts: {
  fullName: string
  username: string
  isMe: boolean
  followLabel?: string
  summits: string
  km: string
  ascent: string
  todaySteps?: number
}) {
  return {
    back: 'Nazad',
    menu: 'Meni profila',
    editProfile: 'Uredi profil',
    follow: opts.followLabel ?? 'Zaprati',
    avatar: opts.isMe
      ? 'Profilna slika, dodirnite za izmjenu'
      : `Profilna slika, ${opts.fullName || opts.username}`,
    passportShortcut: 'Planinarska legitimacija i članski podaci, otvori podešavanja',
    kpis: {
      summits: `${opts.summits} osvojeno`,
      km: `${opts.km} kilometara`,
      ascent: `${opts.ascent} metara uspona`,
    },
    steps:
      opts.todaySteps == null
        ? null
        : `Današnja aktivnost, ${opts.todaySteps.toLocaleString('sr-RS')} koraka`,
  }
}

/** Duga imena/klubovi ne smiju bacati — truncate u UI-u; ovdje samo stabilan display string. */
export function safeDisplayText(value: string | null | undefined, fallback = ''): string {
  if (value == null) return fallback
  return String(value)
}
