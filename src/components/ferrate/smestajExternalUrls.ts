/** Vraća bezbedan http(s) URL ili null. */
export function safeHttpUrl(raw: string | undefined | null): string | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  const withScheme = /^https?:\/\//i.test(t) ? t : t.startsWith('www.') ? `https://${t}` : `https://${t}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href
  } catch {
    return null
  }
}

/** @username ili kratko ime → https://www.instagram.com/username */
export function normalizeInstagramUrl(raw: string | undefined | null): string | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return safeHttpUrl(t)
  const handle = t.replace(/^@/, '').replace(/\/+$/, '').split('/')[0]?.trim()
  if (!handle) return null
  return `https://www.instagram.com/${handle}/`
}
