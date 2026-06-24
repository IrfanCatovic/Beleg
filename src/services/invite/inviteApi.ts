import axios from 'axios'
import api from '../api'
import {
  fetchClubInviteCodeForAdmin as fetchClubInviteCodeForAdminShared,
  isValidInviteCodeFormat,
  normalizeInviteCodeInput,
  regenerateClubInviteCode as regenerateClubInviteCodeShared,
  registerMemberByInvite as registerMemberByInviteShared,
  validateInviteCode,
} from '@beleg/shared/services'
import type { ClubInviteCodeForAdmin, InviteCodeValidationResult } from '@beleg/shared/services'

export type { ClubInviteCodeForAdmin, InviteCodeValidationResult }
export { normalizeInviteCodeInput, isValidInviteCodeFormat }

export async function fetchClubInviteCodeForAdmin(): Promise<ClubInviteCodeForAdmin> {
  return fetchClubInviteCodeForAdminShared(api)
}

export async function regenerateClubInviteCode(): Promise<ClubInviteCodeForAdmin> {
  return regenerateClubInviteCodeShared(api)
}

export async function validateInviteCodePublic(raw: string): Promise<InviteCodeValidationResult> {
  return validateInviteCode(api, raw)
}

export async function registerMemberByInvite(formData: FormData): Promise<void> {
  return registerMemberByInviteShared(api, formData)
}

/** POST regenerate vratio 429 milisekunde do sledećeg dozvoljenog restarta (ako backend pošalje polje). */
export function getRegenerateCooldownMs(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null
  if (error.response?.status !== 429) return null
  const ms = (error.response.data as { regenAvailableInMs?: number })?.regenAvailableInMs
  return typeof ms === 'number' ? ms : null
}
