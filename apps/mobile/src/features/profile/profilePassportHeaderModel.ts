/** Pravila Faze A — Planinarski pasoš header (testabilno bez RN rendera). */

export const PASSPORT_PUBLIC_KPI_LABELS = ['USPON', 'STAZA', 'OSVOJENIH', 'KORACI'] as const

export function shouldShowOwnerPassportShortcut(isMe: boolean, canOpenSettings: boolean): boolean {
  return isMe && canOpenSettings
}

export function shouldShowOwnerStepsCard(isMe: boolean): boolean {
  void isMe
  return false
}

/** Koraci su javni KPI u header metrics redu (4. kolona). */
export function isStepsPublicHeaderKpi(): boolean {
  return true
}

export function getOwnerPrimaryCtaLabel(canOpenSettings: boolean): string | null {
  void canOpenSettings
  return null
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
