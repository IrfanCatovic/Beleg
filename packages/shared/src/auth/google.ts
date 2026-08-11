import type { AxiosInstance } from 'axios'
import type { LoginResponse } from './session'

export interface GoogleAuthAuthenticatedResponse extends LoginResponse {
  status: 'authenticated'
}

export interface GoogleAuthOnboardingRequiredResponse {
  status: 'onboarding_required'
  onboardingToken: string
  email: string
  fullName: string
  avatarUrl: string
  suggestedUsername: string
}

export interface GoogleAuthLinkRequiredResponse {
  status: 'link_required'
  code: 'SOCIAL_ACCOUNT_LINK_REQUIRED'
  linkToken: string
}

export type GoogleStartAuthResponse =
  | GoogleAuthAuthenticatedResponse
  | GoogleAuthOnboardingRequiredResponse
  | GoogleAuthLinkRequiredResponse

export interface CompleteGoogleOnboardingPayload {
  onboardingToken: string
  username: string
  pol: string
  datumRodjenja: string
}

export interface GoogleLinkAccountResponse {
  status: 'authenticated'
}

export async function startGoogleAuth(
  client: AxiosInstance,
  idToken: string,
): Promise<GoogleStartAuthResponse> {
  const res = await client.post<GoogleStartAuthResponse>('/api/auth/social/google', { idToken })
  return res.data
}

export async function completeGoogleOnboarding(
  client: AxiosInstance,
  payload: CompleteGoogleOnboardingPayload,
): Promise<GoogleAuthAuthenticatedResponse> {
  const res = await client.post<GoogleAuthAuthenticatedResponse>(
    '/api/auth/social/google/complete',
    {
      onboardingToken: payload.onboardingToken,
      username: payload.username.trim().toLowerCase(),
      pol: payload.pol,
      datumRodjenja: payload.datumRodjenja,
    },
  )
  return res.data
}

export async function linkGoogleAccount(
  client: AxiosInstance,
  linkToken: string,
): Promise<GoogleLinkAccountResponse> {
  const res = await client.post<GoogleLinkAccountResponse>('/api/auth/social/google/link', {
    linkToken,
  })
  return res.data
}

/** Alias for GAUTH shared-contract audit and call sites that expect a login-shaped helper name. */
export const googleLoginApi = startGoogleAuth
export const socialLoginApi = startGoogleAuth
export const completeGoogleOnboardingApi = completeGoogleOnboarding
export const linkGoogleAccountApi = linkGoogleAccount
