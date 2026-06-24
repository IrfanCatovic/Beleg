import type { AxiosInstance } from 'axios'
import { isValidInviteCodeFormat, normalizeInviteCodeInput } from '../domain/invite/inviteCodeFormat'
import type { ClubInviteCodeForAdmin, InviteCodeValidationResult } from '../domain/invite/types'

export { normalizeInviteCodeInput, isValidInviteCodeFormat } from '../domain/invite/inviteCodeFormat'
export type { ClubInviteCodeForAdmin, InviteCodeValidationResult } from '../domain/invite/types'

export async function validateInviteCode(
  client: AxiosInstance,
  raw: string,
): Promise<InviteCodeValidationResult> {
  const code = normalizeInviteCodeInput(raw)
  if (!isValidInviteCodeFormat(code)) {
    return { ok: false, error: 'INVALID_FORMAT' }
  }
  const res = await client.post<{ valid?: boolean; klubId?: number; klubNaziv?: string; error?: string }>(
    '/api/invite-code/validate',
    { code },
  )
  const data = res.data
  if (data.valid && data.klubId != null) {
    return { ok: true, klubId: data.klubId, klubNaziv: data.klubNaziv }
  }
  return { ok: false, error: data.error }
}

export async function registerMemberByInvite(
  client: AxiosInstance,
  formData: FormData,
): Promise<void> {
  await client.post('/api/register/invite', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export async function fetchClubInviteCodeForAdmin(
  client: AxiosInstance,
): Promise<ClubInviteCodeForAdmin> {
  const res = await client.get<{
    inviteCode?: string
    regenAvailableInMs?: number
    expiresAt?: string | null
  }>('/api/klub/invite-code')
  return {
    inviteCode: res.data.inviteCode ?? '',
    regenAvailableInMs: res.data.regenAvailableInMs,
    expiresAt: res.data.expiresAt,
  }
}

export async function regenerateClubInviteCode(
  client: AxiosInstance,
): Promise<ClubInviteCodeForAdmin> {
  const res = await client.post<{
    inviteCode?: string
    regenAvailableInMs?: number
    expiresAt?: string | null
  }>('/api/klub/invite-code/regenerate')
  return {
    inviteCode: res.data.inviteCode ?? '',
    regenAvailableInMs: res.data.regenAvailableInMs,
    expiresAt: res.data.expiresAt,
  }
}
