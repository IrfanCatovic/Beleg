import api from './api'

export async function submitCenaZahtev(
  payload: Record<string, unknown>,
  options?: { timeout?: number; withCredentials?: boolean },
) {
  await api.post('/api/cena-zahtev', payload, {
    timeout: options?.timeout ?? 45_000,
    withCredentials: options?.withCredentials ?? false,
  })
}
