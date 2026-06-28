import type { AxiosInstance } from 'axios'
import { regenerateAkcijaInviteLink } from '../services/actions'

export function buildActionShareUrl(
  webBaseUrl: string,
  actionId: number | string,
  inviteToken?: string,
): string {
  const base = webBaseUrl.replace(/\/$/, '')
  const path = `/akcije/${actionId}`
  if (inviteToken?.trim()) {
    return `${base}${path}?inviteToken=${encodeURIComponent(inviteToken.trim())}`
  }
  return `${base}${path}`
}

export function buildActionInviteWhatsAppMessage(actionName: string, shareUrl: string): string {
  return `Hej! Pridruži se akciji „${actionName}" na Planineru:\n${shareUrl}`
}

export function encodeWhatsAppShareMessage(message: string): { appUrl: string; webUrl: string } {
  const encoded = encodeURIComponent(message)
  return {
    appUrl: `whatsapp://send?text=${encoded}`,
    webUrl: `https://wa.me/?text=${encoded}`,
  }
}

export interface ResolveActionInviteShareUrlOptions {
  actionId: number | string
  isPublic: boolean
  webBaseUrl: string
  inviteToken?: string
  canManageHost: boolean
  cachedUrl?: string
}

export async function resolveActionInviteShareUrl(
  client: AxiosInstance,
  options: ResolveActionInviteShareUrlOptions,
): Promise<string> {
  const { actionId, isPublic, webBaseUrl, inviteToken, canManageHost, cachedUrl } = options

  if (inviteToken?.trim()) {
    return buildActionShareUrl(webBaseUrl, actionId, inviteToken)
  }
  if (isPublic) {
    return buildActionShareUrl(webBaseUrl, actionId)
  }
  if (!canManageHost) {
    throw new Error('PRIVATE_SHARE_FORBIDDEN')
  }
  if (cachedUrl?.trim()) {
    return cachedUrl.trim()
  }

  const res = await regenerateAkcijaInviteLink(client, actionId)
  const token = (res.inviteToken ?? '').trim()
  if (token) {
    return buildActionShareUrl(webBaseUrl, actionId, token)
  }
  const inviteUrl = (res.inviteUrl ?? '').trim()
  if (!inviteUrl) {
    throw new Error('INVITE_URL_FAILED')
  }
  return inviteUrl
}
