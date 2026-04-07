import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from './constants'

const allowed = new Set(INVITE_CODE_ALPHABET.split(''))

/**
 * Uklanja razmake, prebacuje na velika slova — kako korisnik često lepi kod sa grupe.
 */
export function normalizeInviteCodeInput(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

/**
 * Provera formata pre slanja na server (brz feedback, manje lažnih zahteva).
 * Strogo: tačno 8 znakova, samo dozvoljeni iz {@link INVITE_CODE_ALPHABET}.
 */
export function isValidInviteCodeFormat(normalized: string): boolean {
  if (normalized.length !== INVITE_CODE_LENGTH) return false
  for (let i = 0; i < normalized.length; i++) {
    if (!allowed.has(normalized[i]!)) return false
  }
  return true
}
