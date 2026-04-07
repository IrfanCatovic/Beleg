import axios from 'axios'
import api from '../api'
import type { ClubInviteCodeForAdmin, InviteCodeValidationResult } from '../../domain/invite'
import {
  isValidInviteCodeFormat,
  normalizeInviteCodeInput,
} from '../../domain/invite'
import type {
  ClubInviteCodeAdminResponse,
  InviteCodeValidateResponse,
} from './inviteApi.types'

/**
 * Admin / sekretar: trenutni kod za klub u kom je korisnik (effective klub).
 * Backend mora da proveri ulogu i da veže odgovor za taj klub.
 */
export async function fetchClubInviteCodeForAdmin(): Promise<ClubInviteCodeForAdmin> {
  const res = await api.get<ClubInviteCodeAdminResponse>('/api/klub/invite-code')
  return res.data
}

/**
 * Novi kod (cooldown 12h na backendu; ako je prerano → 429 sa regenAvailableInMs u telu).
 */
export async function regenerateClubInviteCode(): Promise<ClubInviteCodeForAdmin> {
  const res = await api.post<ClubInviteCodeAdminResponse>('/api/klub/invite-code/regenerate')
  return res.data
}

/**
 * Javno: da li postoji aktivan klub za ovaj kod.
 * Pre slanja proveravamo format (manje zahteva, brži feedback).
 */
export async function validateInviteCodePublic(raw: string): Promise<InviteCodeValidationResult> {
  const code = normalizeInviteCodeInput(raw)
  if (!isValidInviteCodeFormat(code)) {
    return { ok: false, error: 'INVALID_FORMAT' }
  }

  const res = await api.post<InviteCodeValidateResponse>('/api/invite-code/validate', { code })
  const data = res.data
  if (data.valid) {
    return { ok: true, klubId: data.klubId, klubNaziv: data.klubNaziv }
  }
  return { ok: false, error: data.error }
}

/**
 * Javna registracija člana: isto telo kao POST /api/register + inviteCode (+ opciono klubId za proveru).
 * Backend mora da validira kod, kreira korisnika sa ulogom clan i veže ga za taj klub.
 */
export async function registerMemberByInvite(formData: FormData): Promise<void> {
  await api.post('/api/register/invite', formData)
}

/** POST regenerate vratio 429 milisekunde do sledećeg dozvoljenog restarta (ako backend pošalje polje). */
export function getRegenerateCooldownMs(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null
  if (error.response?.status !== 429) return null
  const ms = (error.response.data as { regenAvailableInMs?: number })?.regenAvailableInMs
  return typeof ms === 'number' ? ms : null
}
