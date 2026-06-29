import type { AxiosInstance } from 'axios'

export interface PushTokenPayload {
  token: string
  platform?: 'android' | 'ios'
  appKind?: 'expo' | 'standalone'
}

export interface PushTokenSummary {
  platform: string
  appKind: string
  suffix: string
  updatedAt: string
}

export interface PushTokenRegisterResponse {
  ok: boolean
  tokens: PushTokenSummary[]
}

export async function registerPushToken(
  client: AxiosInstance,
  payload: PushTokenPayload,
): Promise<PushTokenRegisterResponse> {
  const { data } = await client.put<PushTokenRegisterResponse>('/api/push-tokens', payload)
  return data
}

export async function fetchMyPushTokens(client: AxiosInstance): Promise<PushTokenSummary[]> {
  const { data } = await client.get<{ ok: boolean; tokens: PushTokenSummary[] }>('/api/push-tokens')
  return data.tokens ?? []
}

export async function unregisterPushToken(client: AxiosInstance, token: string): Promise<void> {
  await client.delete('/api/push-tokens', { data: { token } })
}
