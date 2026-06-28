import type { AkcijaDetail } from '../types/akcija'

/** Da li dodeljeni vodič može primiti ocene (mora imati odobren profi profil). */
export function vodicCanReceiveGuideRatings(
  akcija: Pick<AkcijaDetail, 'vodicId' | 'vodic'>,
): boolean {
  return (akcija.vodicId ?? 0) > 0 && akcija.vodic?.isProfiGuide === true
}
