import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from './constants'

const allowed = new Set(INVITE_CODE_ALPHABET.split(''))

export function normalizeInviteCodeInput(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

export function isValidInviteCodeFormat(normalized: string): boolean {
  if (normalized.length !== INVITE_CODE_LENGTH) return false
  for (let i = 0; i < normalized.length; i++) {
    if (!allowed.has(normalized[i]!)) return false
  }
  return true
}
