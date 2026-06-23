import { StyleSheet, View } from 'react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AkcijaDetail } from '@beleg/shared'
import {
  buildActionInviteWhatsAppMessage,
  getApiErrorMessage,
  resolveActionInviteShareUrl,
} from '@beleg/shared'
import { client } from '../../../api/client'
import { Button } from '../../../components/ui'
import { spacing } from '../../../theme'
import { openWhatsAppWithMessage } from '../../../utils/openWhatsApp'

function getWebBaseUrl(): string {
  const web = process.env.EXPO_PUBLIC_WEB_URL ?? process.env.EXPO_PUBLIC_API_URL ?? ''
  return web.replace(/\/$/, '')
}

interface ActionDetailShareRowProps {
  akcija: AkcijaDetail
  canManageHost: boolean
  inviteToken?: string
  onError: (message: string) => void
}

export function ActionDetailShareRow({
  akcija,
  canManageHost,
  inviteToken,
  onError,
}: ActionDetailShareRowProps) {
  const { t } = useTranslation('actions')
  const [loading, setLoading] = useState(false)
  const [cachedUrl, setCachedUrl] = useState('')

  const canShare =
    !akcija.isCompleted && (akcija.javna || canManageHost || !!inviteToken?.trim())
  if (!canShare) return null

  const handleShare = async () => {
    const webBaseUrl = getWebBaseUrl()
    if (!webBaseUrl) {
      onError('Link za deljenje nije dostupan.')
      return
    }
    setLoading(true)
    try {
      const shareUrl = await resolveActionInviteShareUrl(client, {
        actionId: akcija.id,
        isPublic: !!akcija.javna,
        webBaseUrl,
        inviteToken,
        canManageHost,
        cachedUrl,
      })
      setCachedUrl(shareUrl)
      const message = buildActionInviteWhatsAppMessage(akcija.naziv, shareUrl)
      await openWhatsAppWithMessage(message)
    } catch (err) {
      if (err instanceof Error && err.message === 'PRIVATE_SHARE_FORBIDDEN') {
        onError(t('invitePrivateOnlyHost'))
        return
      }
      onError(getApiErrorMessage(err, t('inviteShareError')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.wrap}>
      <Button title={t('inviteWhatsApp')} variant="secondary" loading={loading} onPress={() => void handleShare()} fullWidth />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
})
