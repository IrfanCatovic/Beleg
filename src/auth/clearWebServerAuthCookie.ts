import { clearServerAuthCookieBestEffort } from '@beleg/shared'

const apiBaseURL = import.meta.env.VITE_API_URL || ''

/** Web: clear HttpOnly auth cookie without Bearer header (public /api/logout). */
export function clearWebServerAuthCookieBestEffort(): Promise<void> {
  return clearServerAuthCookieBestEffort({
    baseURL: apiBaseURL,
    withCredentials: true,
  })
}
