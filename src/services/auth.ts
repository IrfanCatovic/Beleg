import api from './api'

export async function fetchSetupStatus() {
  const res = await api.get<{
    needsSuperadmin?: boolean
    hasUsers?: boolean
    setupCompleted?: boolean
    hasSuperadmin?: boolean
    setupComplete?: boolean
  }>('/api/setup/status', { timeout: 15_000 })
  return res.data
}

export async function login(username: string, password: string, rememberMe = true) {
  const res = await api.post('/login', {
    username: username.trim(),
    password,
    remember_me: rememberMe,
  })
  return res.data
}

export async function registerSuperAdmin(formData: FormData) {
  await api.post('/api/register', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export async function registerOpen(payload: Record<string, unknown>) {
  await api.post('/api/register/open', payload)
}

export async function requestPasswordReset(email: string) {
  const res = await api.post<{ message?: string }>('/api/password/forgot', { email: email.trim() })
  return res.data
}

export async function resetPassword(token: string, newPassword: string) {
  const res = await api.post<{ message?: string }>('/api/password/reset', { token, newPassword })
  return res.data
}

export async function verifyEmail(token: string) {
  const res = await api.get<{ message?: string }>('/api/email/verify', { params: { token } })
  return res.data
}
