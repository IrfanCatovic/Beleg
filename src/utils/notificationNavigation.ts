import {
  buildWebNotificationPath,
  resolveNotificationNavigationTarget,
  type NotificationNavigationTarget,
} from '@beleg/shared'

export type ObavestenjeNavItem = {
  id: number
  type: string
  link?: string
  metadata?: string
}

/** Resolve notification click destination for web router. */
export function resolveWebNotificationPath(item: ObavestenjeNavItem): string | null {
  const target = resolveNotificationNavigationTarget({
    type: item.type,
    link: item.link,
    metadata: item.metadata,
    notificationId: item.id,
  })
  return buildWebNotificationPath(target) ?? detailFallbackPath(target, item.id)
}

function detailFallbackPath(
  target: NotificationNavigationTarget,
  notificationId: number,
): string | null {
  if (target.kind === 'none' && notificationId > 0) {
    return `/obavestenja/${notificationId}`
  }
  return null
}
