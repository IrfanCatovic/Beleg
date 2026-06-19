import type { AxiosInstance } from 'axios'

export async function fetchFinansijeDashboard(
  client: AxiosInstance,
  params: Record<string, string>,
): Promise<unknown> {
  const res = await client.get('/api/finansije/dashboard', { params })
  return res.data
}

export async function fetchClanarine(client: AxiosInstance, godina: number): Promise<unknown> {
  const res = await client.get('/api/finansije/clanarine', { params: { godina } })
  return res.data
}

export async function createTransakcija(
  client: AxiosInstance,
  payload: Record<string, unknown>,
): Promise<void> {
  await client.post('/api/finansije', payload)
}

export async function createClanarina(
  client: AxiosInstance,
  payload: Record<string, unknown>,
): Promise<void> {
  await client.post('/api/finansije/clanarina', payload)
}

export async function deleteTransakcija(client: AxiosInstance, id: number): Promise<void> {
  await client.delete(`/api/finansije/transakcije/${id}`)
}
