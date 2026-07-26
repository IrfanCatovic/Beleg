/** Copy i pravila empty/error stanja Planinarskog pasoša (Faza B). */

export type ProfileActionsMode = 'climbed' | 'guided'

export function getClimbedEmptyCopy(isOwn: boolean): {
  title: string
  body: string
  ctaLabel: string | null
} {
  if (isOwn) {
    return {
      title: 'Još nema zabilježenih uspona',
      body: 'Kada završiš planinarsku akciju, ona će postati dio tvog Planinarskog pasoša.',
      ctaLabel: 'Pronađi akciju',
    }
  }
  return {
    title: 'Ovaj korisnik još nema javno zabilježene uspone.',
    body: '',
    ctaLabel: null,
  }
}

export function getGuidedEmptyCopy(isOwn: boolean): {
  title: string
  body: string
  ctaLabel: string | null
} {
  if (isOwn) {
    return {
      title: 'Još nema vođenih tura',
      body: 'Ture koje budeš vodio pojaviće se ovdje kao dio tvog vodičkog iskustva.',
      ctaLabel: null,
    }
  }
  return {
    title: 'Ovaj vodič još nema javno evidentirane vođene ture.',
    body: '',
    ctaLabel: null,
  }
}

/** Vođene ture tab samo ako je vodič ili već ima vođene akcije. */
export function shouldShowGuidedActionsTab(opts: {
  isProfiGuide: boolean
  guidedCount: number
}): boolean {
  return opts.isProfiGuide || opts.guidedCount > 0
}

export function getNoClubOwnCopy(): string {
  return 'Nisi povezan sa planinarskim klubom.'
}

export function getStatsErrorCopy(): string {
  return 'Statistika trenutno nije dostupna.'
}

export function getHistoryErrorCopy(): string {
  return 'Nismo uspjeli učitati planinarsku istoriju.'
}

export function getRetryLabel(): string {
  return 'Pokušaj ponovo'
}

export function actionCardAccessibilityLabel(naziv: string, per: number): string {
  const name = naziv?.trim() || 'Akcija'
  return per > 0 ? `${name}, ${per} PER` : name
}
