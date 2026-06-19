import type { AxiosInstance } from 'axios'
import type { LoginResponse } from './session'

export async function loginApi(
  client: AxiosInstance,
  username: string,
  password: string,
  rememberMe = true,
): Promise<LoginResponse> {
  const res = await client.post<LoginResponse>('/login', {
    username: username.trim(),
    password,
    remember_me: rememberMe,
  })
  return res.data
}
