/**
 * Poslovna pravila za klupske invite kodove (javna self-registracija uz zatvoreni kod).
 * Backend mora da ih poštuje pri čuvanju i validaciji; frontend ih koristi za validaciju formata i prikaz.
 */

/** Dužina koda: tačno 8 znakova iz {@link INVITE_CODE_ALPHABET}. */
export const INVITE_CODE_LENGTH = 8

/**
 * Skup znakova za kod (bez dvosmislenih: npr. bez O/0 ako backend tako odluči — ovde samo latinica + cifre).
 * Mora biti usklađen sa backend generatorom.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' as const

/** Minimalni interval između dva ručna "restartovanja" koda (admin/sekretar). */
export const INVITE_CODE_REGEN_COOLDOWN_MS = 12 * 60 * 60 * 1000

/**
 * Opciono: koliko dugo važi jedan kod pre automatske zamene (ako backend to implementira).
 * Ne mora da bude isto kao cooldown za ručni restart.
 */
export const INVITE_CODE_DEFAULT_TTL_MS = 48 * 60 * 60 * 1000
