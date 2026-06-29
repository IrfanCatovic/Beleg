import { useCallback, useEffect, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { fetchMyPushTokens, type PushTokenSummary } from '@beleg/shared/services'
import { client } from '../api/client'
import { Button, Card, Text } from './ui'
import { colors, spacing } from '../theme'
import { PUSH_DEBUG_KEY } from '../hooks/usePushNotifications'

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="small" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="small" style={styles.mono}>
        {value}
      </Text>
    </View>
  )
}

function formatServerTokens(tokens: PushTokenSummary[]): string {
  if (tokens.length === 0) return 'nema tokena na serveru'
  return tokens
    .map((t) => `${t.appKind || '?'}:${t.platform || '?'} …${t.suffix}`)
    .join(' | ')
}

export function PushDebugPanel() {
  const [debugJson, setDebugJson] = useState<string | null>(null)
  const [serverTokens, setServerTokens] = useState<PushTokenSummary[] | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [perm, setPerm] = useState<string>('?')
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const stored = await AsyncStorage.getItem(PUSH_DEBUG_KEY)
      setDebugJson(stored)
      const p = await Notifications.getPermissionsAsync()
      setPerm(p.status)
      try {
        const tokens = await fetchMyPushTokens(client)
        setServerTokens(tokens)
        setServerError(null)
      } catch (err) {
        setServerTokens(null)
        setServerError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  const projectId = extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? 'missing'
  const hasStandaloneAndroid = (serverTokens ?? []).some(
    (t) => t.platform === 'android' && t.appKind === 'standalone',
  )

  return (
    <Card style={styles.card}>
      <Text variant="label">Push debug</Text>
      <Text variant="small" color={colors.textMuted} style={styles.hint}>
        Server šalje na SVE tokene korisnika. Expo Go i APK imaju različite tokene.
      </Text>
      <DebugRow label="appOwnership" value={String(Constants.appOwnership ?? '?')} />
      <DebugRow label="executionEnvironment" value={String(Constants.executionEnvironment ?? '?')} />
      <DebugRow label="isDevice" value={String(Device.isDevice)} />
      <DebugRow label="platform" value={Platform.OS} />
      <DebugRow label="projectId" value={projectId === 'missing' ? 'MISSING' : `${projectId.slice(0, 8)}…`} />
      <DebugRow label="permission now" value={perm} />
      <DebugRow label="server tokens" value={serverError ?? formatServerTokens(serverTokens ?? [])} />
      <DebugRow
        label="APK token na serveru"
        value={hasStandaloneAndroid ? 'DA' : 'NE — push ne može stići na APK'}
      />
      <DebugRow label="last register" value={debugJson ?? '—'} />
      <Button
        title={loading ? 'Učitavam…' : 'Osvježi push debug'}
        variant="secondary"
        onPress={() => void refresh()}
        disabled={loading}
      />
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginTop: spacing.md },
  hint: { marginBottom: spacing.xs },
  row: { gap: 2 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 },
})
