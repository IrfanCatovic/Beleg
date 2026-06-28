const DEFAULT_WEB_URL = 'https://www.planiner.com'

export function getWebBaseUrl(): string {
  const web = process.env.EXPO_PUBLIC_WEB_URL?.trim() || DEFAULT_WEB_URL
  return web.replace(/\/$/, '')
}

export function getRegisterUrl(): string {
  const base = getWebBaseUrl()
  return base ? `${base}/registracija` : '/registracija'
}
