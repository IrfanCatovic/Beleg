/**
 * Best-effort server auth cookie clear via public POST /api/logout.
 * Intentionally does NOT send Authorization Bearer (invalid Bearer blocks cookie on backend).
 */
export async function clearServerAuthCookieBestEffort(options: {
  baseURL: string
  withCredentials?: boolean
}): Promise<void> {
  const trimmed = options.baseURL.replace(/\/$/, '')
  const url = trimmed ? `${trimmed}/api/logout` : '/api/logout'
  try {
    await fetch(url, {
      method: 'POST',
      credentials: options.withCredentials ? 'include' : 'omit',
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    // network/timeout/4xx/5xx — local session already cleared; cookie clear is best-effort
  }
}
