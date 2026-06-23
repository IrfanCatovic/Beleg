import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { AkcijaDetail } from '@beleg/shared'
import {
  buildActionInviteWhatsAppMessage,
  getApiErrorMessage,
  resolveActionInviteShareUrl,
} from '@beleg/shared'
import { client } from '../../../api/client'
import { Button, Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'
import { openWhatsAppWithMessage } from '../../../utils/openWhatsApp'

function getWebBaseUrl(): string {
  const web = process.env.EXPO_PUBLIC_WEB_URL ?? process.env.EXPO_PUBLIC_API_URL ?? ''
  return web.replace(/\/$/, '')
}

interface ActionDetailInviteShareCardProps {
  akcija: AkcijaDetail
  canManageHost: boolean
  inviteToken?: string
  onError: (message: string) => void
}

export function ActionDetailInviteShareCard({
  akcija,
  canManageHost,
  inviteToken,
  onError,
}: ActionDetailInviteShareCardProps) {
  const { t } = useTranslation('actions')
  const [loading, setLoading] = useState(false)
  const [cachedUrl, setCachedUrl] = useState('')

  const canShare =
    !akcija.isCompleted && (akcija.javna || canManageHost || !!inviteToken?.trim())

  if (!canShare) return null

  const handleShare = async () => {
    const webBaseUrl = getWebBaseUrl()
    if (!webBaseUrl) {
      onError('Link za deljenje nije dostupan. Proverite EXPO_PUBLIC_WEB_URL.')
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
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>+</Text>
        </View>
        <Text variant="small" color={colors.brand} style={styles.title}>
          {t('inviteTitle')}
        </Text>
      </View>
      <Text variant="small" color={colors.textMuted} style={styles.desc}>
        {akcija.javna ? t('inviteDescPublic') : t('inviteDescPrivate')}
      </Text>
      <Button
        title={t('inviteWhatsApp')}
        onPress={() => void handleShare()}
        variant="primary"
        loading={loading}
        fullWidth
      />
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  title: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  desc: { marginBottom: spacing.md },
})
