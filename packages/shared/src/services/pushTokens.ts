import type { AxiosInstance } from 'axios'

export interface PushTokenPayload {
  token: string
  platform?: 'android' | 'ios'
}

export async function registerPushToken(client: AxiosInstance, payload: PushTokenPayload): Promise<void> {
  await client.put('/api/push-tokens', payload)
}

export async function unregisterPushToken(client: AxiosInstance, token: string): Promise<void> {
  await client.delete('/api/push-tokens', { data: { token } })
}
