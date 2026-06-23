export function getWebBaseUrl(): string {
  const web = process.env.EXPO_PUBLIC_WEB_URL ?? process.env.EXPO_PUBLIC_API_URL ?? ''
  return web.replace(/\/$/, '')
}

export function getRegisterUrl(): string {
  const base = getWebBaseUrl()
  return base ? `${base}/registracija` : '/registracija'
}
