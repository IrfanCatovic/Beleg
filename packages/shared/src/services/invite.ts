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

type ClubInviteCodeAdminApiResponse = {
  /** Backend polje (GET/POST /api/klub/invite-code*) */
  code?: string
  inviteCode?: string
  regenAvailableInMs?: number
  expiresAt?: string | null
}

function mapClubInviteCodeAdminResponse(data: ClubInviteCodeAdminApiResponse): ClubInviteCodeForAdmin {
  return {
    inviteCode: data.inviteCode ?? data.code ?? '',
    regenAvailableInMs: data.regenAvailableInMs,
    expiresAt: data.expiresAt,
  }
}

export async function fetchClubInviteCodeForAdmin(
  client: AxiosInstance,
): Promise<ClubInviteCodeForAdmin> {
  const res = await client.get<ClubInviteCodeAdminApiResponse>('/api/klub/invite-code')
  return mapClubInviteCodeAdminResponse(res.data)
}

export async function regenerateClubInviteCode(
  client: AxiosInstance,
): Promise<ClubInviteCodeForAdmin> {
  const res = await client.post<ClubInviteCodeAdminApiResponse>('/api/klub/invite-code/regenerate')
  return mapClubInviteCodeAdminResponse(res.data)
}
