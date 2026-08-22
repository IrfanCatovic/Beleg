import { useCallback, useEffect, useState } from 'react'
import { Share, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { ClubInviteCodeForAdmin } from '@beleg/shared/services'
import { fetchClubInviteCodeForAdmin, regenerateClubInviteCode } from '@beleg/shared/services'
import axios from 'axios'
import { client } from '../../api/client'
import { Button, Card, Loader, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'

const MEMBER_REGISTRATION_URL = 'https://planiner.com/registracija-kod'

function formatCooldown(ms: number): string {
  if (ms <= 0) return ''
  const totalSec = Math.ceil(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function getRegenerateCooldownMs(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null
  if (error.response?.status !== 429) return null
  const ms = (error.response.data as { regenAvailableInMs?: number })?.regenAvailableInMs
  return typeof ms === 'number' ? ms : null
}

export default function ClubInviteCodeCard() {
  const { t } = useTranslation('clubAdmin')
  const [data, setData] = useState<ClubInviteCodeForAdmin | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState('')
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0)

  const load = useCallback(async (silent?: boolean) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setLoadError(false)
    try {
      const d = await fetchClubInviteCodeForAdmin(client)
      setData(d)
      setCooldownRemainingMs(Math.max(0, d.regenAvailableInMs ?? 0))
    } catch {
      setLoadError(true)
      setData(null)
    } finally {
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const id = setInterval(() => {
      setCooldownRemainingMs((prev) => (prev <= 1000 ? 0 : prev - 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const handleRegenerate = async () => {
    if (cooldownRemainingMs > 0 || regenerating) return
    setRegenError('')
    setRegenerating(true)
    try {
      const d = await regenerateClubInviteCode(client)
      setData(d)
      setCooldownRemainingMs(Math.max(0, d.regenAvailableInMs ?? 0))
    } catch (err: unknown) {
      const cd = getRegenerateCooldownMs(err)
      if (cd != null && cd > 0) setCooldownRemainingMs(cd)
      else setRegenError(t('inviteRegenError'))
    } finally {
      setRegenerating(false)
    }
  }

  const handleShare = async () => {
    if (!data?.inviteCode) return
    const message = t('inviteShareMessage', {
      code: data.inviteCode,
      url: MEMBER_REGISTRATION_URL,
    })
    try {
      await Share.share({ message, url: MEMBER_REGISTRATION_URL })
    } catch {
      /* user dismissed */
    }
  }

  const expiresLabel = (iso: string | null | undefined) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return '—'
    }
  }

  if (loading) {
    return (
      <Card style={styles.card}>
        <Loader />
        <Text variant="small" color={colors.textMuted} style={styles.centeredText}>
          {t('inviteLoading')}
        </Text>
      </Card>
    )
  }

  if (loadError || !data?.inviteCode) {
    return (
      <Card style={styles.card}>
        <Text color={colors.danger}>{t('inviteLoadError')}</Text>
        <Button title={t('inviteRefresh')} variant="secondary" onPress={() => void load(true)} loading={refreshing} />
      </Card>
    )
  }

  const canRegenerate = cooldownRemainingMs <= 0 && !regenerating

  return (
    <Card style={styles.card}>
      <Text variant="label" color={colors.brand}>{t('inviteTitle')}</Text>
      <Text variant="small" color={colors.textMuted} style={styles.subtitle}>
        {t('inviteSubtitle')}
      </Text>

      <View style={styles.codeRow}>
        <Text style={styles.code}>{data.inviteCode}</Text>
      </View>

      <Text variant="small" color={colors.textMuted}>
        {t('inviteExpires', { date: expiresLabel(data.expiresAt) })}
      </Text>

      <Text variant="small" color={colors.textMuted} style={styles.link}>
        {MEMBER_REGISTRATION_URL}
      </Text>

      <View style={styles.actions}>
        <Button title={t('inviteShare')} onPress={() => void handleShare()} variant="primary" />
        <Button
          title={refreshing ? t('inviteRefreshing') : t('inviteRefresh')}
          onPress={() => void load(true)}
          variant="secondary"
          loading={refreshing}
        />
        <Button
          title={regenerating ? t('inviteRegenerating') : t('inviteRegenerate')}
          onPress={() => void handleRegenerate()}
          variant="secondary"
          disabled={!canRegenerate}
          loading={regenerating}
        />
      </View>

      {!canRegenerate && cooldownRemainingMs > 0 ? (
        <Text variant="small" color={colors.textMuted}>
          {t('inviteCooldown', { time: formatCooldown(cooldownRemainingMs) })}
        </Text>
      ) : null}

      {regenError ? <Text variant="small" color={colors.danger}>{regenError}</Text> : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  subtitle: { lineHeight: 20 },
  codeRow: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  code: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  link: { marginTop: spacing.xs },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  centeredText: { textAlign: 'center', marginTop: spacing.sm },
})
