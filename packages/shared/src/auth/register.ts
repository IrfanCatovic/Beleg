import type { AxiosInstance } from 'axios'

export interface OpenRegistrationPayload {
  username: string
  password: string
  pol: string
  datumRodjenja: string
  email: string
  fullName: string
}

export async function registerOpenApi(
  client: AxiosInstance,
  payload: OpenRegistrationPayload,
): Promise<void> {
  await client.post('/api/register/open', {
    ...payload,
    username: payload.username.trim().toLowerCase(),
    email: payload.email.trim().toLowerCase(),
    fullName: payload.fullName.trim(),
  })
}

export async function requestPasswordResetApi(
  client: AxiosInstance,
  email: string,
): Promise<{ message?: string }> {
  const res = await client.post<{ message?: string }>('/api/password/forgot', {
    email: email.trim(),
  })
  return res.data
}
