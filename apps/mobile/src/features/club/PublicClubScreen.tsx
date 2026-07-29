import { useMemo } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage, formatActionDateShort } from '@beleg/shared'
import {
  cancelJoinRequest,
  createJoinRequest,
  fetchMyJoinRequests,
  fetchPublicClubById,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Avatar, Button, Card, ErrorView, Loader, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import { publicClubKeys } from './queryKeys'
import {
  positiveClubId,
  publicClubHasAboutSection,
  resolvePublicClubJoinCta,
} from './publicClubModel'
import type {
  ClubStackParamList,
  ExploreStackParamList,
  HomeStackParamList,
} from '../../navigation/types'

type Props =
  | NativeStackScreenProps<HomeStackParamList, 'PublicClub'>
  | NativeStackScreenProps<ExploreStackParamList, 'PublicClub'>
  | NativeStackScreenProps<ClubStackParamList, 'PublicClub'>

function safeWebHref(raw: string | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  const href = value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`
  try {
    const url = new URL(href)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

export default function PublicClubScreen({ route }: Props) {
  const { user } = useAuth()
  const { showAlert } = useModal()
  const queryClient = useQueryClient()
  const clubId = positiveClubId(route.params?.clubId)

  const clubQuery = useQuery({
    queryKey: clubId != null ? publicClubKeys.detail(clubId) : publicClubKeys.detail(0),
    queryFn: () => fetchPublicClubById(client, clubId!),
    enabled: clubId != null,
  })

  const requestsQuery = useQuery({
    queryKey: ['club-join-requests', 'mine'],
    queryFn: () => fetchMyJoinRequests(client),
    enabled: clubId != null && (user?.klubId == null || Number(user.klubId) === 0),
  })

  const pendingRequest = useMemo(() => {
    if (clubId == null) return null
    for (const req of requestsQuery.data?.requests ?? []) {
      if (req.status === 'pending' && req.clubId === clubId) return req
    }
    return null
  }, [clubId, requestsQuery.data])

  const userClubId =
    user?.klubId != null && Number(user.klubId) > 0 ? Number(user.klubId) : null
  const joinCta = resolvePublicClubJoinCta({
    clubId,
    userClubId,
    hasPendingForClub: pendingRequest != null,
  })

  const joinMutation = useMutation({
    mutationFn: () => createJoinRequest(client, clubId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['club-join-requests'] })
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Zahtev nije poslat.')),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelJoinRequest(client, pendingRequest!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['club-join-requests'] })
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Otkazivanje nije uspelo.')),
  })

  if (clubId == null) {
    return (
      <View style={styles.root}>
        <ErrorView message="Klub nije pronađen" />
      </View>
    )
  }

  if (clubQuery.isLoading) {
    return (
      <View style={styles.root}>
        <Loader />
      </View>
    )
  }

  if (clubQuery.isError || !clubQuery.data) {
    return (
      <View style={styles.root}>
        <ErrorView
          message="Klub nije pronađen"
          onRetry={() => {
            void clubQuery.refetch()
          }}
        />
      </View>
    )
  }

  const klub = clubQuery.data
  const webHref = safeWebHref(klub.web_sajt)
  const founded = klub.datum_osnovanja
    ? formatActionDateShort(String(klub.datum_osnovanja).slice(0, 10), '')
    : ''
  const showAbout = publicClubHasAboutSection({
    webSajt: webHref ? klub.web_sajt : '',
    datumOsnivanja: founded,
  })

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hubHeader}>
        <Avatar uri={klub.logoUrl} name={klub.naziv} size={88} />
        <Text variant="title" style={styles.clubName}>
          {klub.naziv}
        </Text>
        {klub.sediste ? (
          <Text color={colors.textMuted} style={styles.clubMeta}>
            {klub.sediste}
          </Text>
        ) : null}
      </View>

      {joinCta === 'withdraw' ? (
        <View style={styles.ctaWrap}>
          <Button
            title="Povuci zahtev"
            variant="secondary"
            loading={cancelMutation.isPending}
            disabled={cancelMutation.isPending || joinMutation.isPending}
            onPress={() => cancelMutation.mutate()}
            fullWidth
          />
        </View>
      ) : null}

      {joinCta === 'send' ? (
        <View style={styles.ctaWrap}>
          <Button
            title="Pošalji zahtev"
            loading={joinMutation.isPending}
            disabled={joinMutation.isPending || cancelMutation.isPending}
            onPress={() => joinMutation.mutate()}
            fullWidth
          />
        </View>
      ) : null}

      {showAbout ? (
        <View>
          <Text variant="label" style={styles.sectionTitle}>
            O klubu
          </Text>
          <Card style={styles.section}>
            {webHref ? (
              <ContactRow icon="globe-outline" label="Web sajt" value={klub.web_sajt!} href={webHref} />
            ) : null}
            {founded ? (
              <ContactRow icon="calendar-outline" label="Datum osnivanja" value={founded} />
            ) : null}
          </Card>
        </View>
      ) : null}
    </ScrollView>
  )
}

function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  href?: string
}) {
  const content = (
    <View style={styles.contactRow}>
      <Ionicons name={icon} size={18} color={colors.brand} />
      <View style={styles.contactText}>
        <Text variant="small" color={colors.textMuted}>
          {label}
        </Text>
        <Text color={href ? colors.brand : colors.text}>{value}</Text>
      </View>
    </View>
  )
  if (href) {
    return (
      <Pressable onPress={() => void Linking.openURL(href)} style={styles.contactPressable}>
        {content}
      </Pressable>
    )
  }
  return content
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  hubHeader: { alignItems: 'center', gap: spacing.sm },
  clubName: { textAlign: 'center' },
  clubMeta: { textAlign: 'center' },
  ctaWrap: { gap: spacing.sm },
  sectionTitle: { marginBottom: spacing.sm },
  section: { gap: spacing.md },
  contactRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  contactText: { flex: 1, gap: 2 },
  contactPressable: { borderRadius: 8 },
})
