import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
import {
  fetchKorisnikByIdOrUsername,
  patchKorisnik,
  removeClubMember,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Avatar, Button, Card, ChipRow, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { canManageClub } from '../../utils/roles'
import { getRoleLabel } from '../../utils/profileRank'
import { colors, spacing } from '../../theme'
import type { ClubStackParamList } from '../../navigation/types'
import { clubMemberKeys } from './queryKeys'

type Props = NativeStackScreenProps<ClubStackParamList, 'ClubMemberAdmin'>

const EDITABLE_ROLES = ['clan', 'vodic', 'blagajnik', 'sekretar', 'menadzer-opreme', 'admin'] as const

export default function ClubMemberAdminScreen({ route, navigation }: Props) {
  const { t } = useTranslation('clubAdmin')
  const { id } = route.params
  const { user } = useAuth()
  const { showConfirm, showAlert } = useModal()
  const queryClient = useQueryClient()
  const [role, setRole] = useState('')

  const canManage = canManageClub(user, user?.klubId)

  const memberQuery = useQuery({
    queryKey: ['korisnik', id, 'admin'],
    queryFn: () => fetchKorisnikByIdOrUsername(client, String(id)),
    enabled: canManage,
  })

  const korisnik = memberQuery.data

  useEffect(() => {
    if (korisnik?.role) setRole(korisnik.role)
  }, [korisnik?.role])

  const saveRoleMutation = useMutation({
    mutationFn: () => patchKorisnik(client, id, { role }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: clubMemberKeys.all })
      await showAlert(t('success'), t('saveRoleSuccess'))
      navigation.goBack()
    },
    onError: (err) => showAlert(t('error'), getApiErrorMessage(err, t('saveRoleError'))),
  })

  const kickMutation = useMutation({
    mutationFn: () => removeClubMember(client, id, ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: clubMemberKeys.all })
      await showAlert(t('done'), t('kickSuccess'))
      navigation.goBack()
    },
    onError: (err) => showAlert(t('error'), getApiErrorMessage(err, t('kickError'))),
  })

  if (!canManage) {
    return (
      <Screen>
        <Text color={colors.textMuted}>{t('adminNoPermission')}</Text>
      </Screen>
    )
  }

  if (memberQuery.isLoading) return <Screen><Loader /></Screen>
  if (memberQuery.isError || !korisnik) {
    return <Screen><ErrorView message={t('memberLoadError')} onRetry={() => memberQuery.refetch()} /></Screen>
  }

  const isSelf = user?.username === korisnik.username

  return (
    <Screen scroll>
      <Card style={styles.card}>
        <Avatar uri={korisnik.avatar_url} name={korisnik.fullName || korisnik.username} size={64} />
        <Text variant="title">{korisnik.fullName || korisnik.username}</Text>
        <Text color={colors.textMuted}>@{korisnik.username}</Text>
        {korisnik.email ? <Text variant="small">{korisnik.email}</Text> : null}
      </Card>

      <View style={styles.section}>
        <ChipRow
          label={t('roleField')}
          options={EDITABLE_ROLES.map((r) => ({ value: r, label: getRoleLabel(r) }))}
          value={role}
          onChange={setRole}
          disabled={isSelf}
        />
        {!isSelf ? (
          <Button
            title={t('saveRole')}
            onPress={() => saveRoleMutation.mutate()}
            loading={saveRoleMutation.isPending}
            fullWidth
          />
        ) : (
          <Text variant="small" color={colors.textMuted}>{t('ownRoleHint')}</Text>
        )}
      </View>

      {!isSelf ? (
        <Button
          title={t('kickMember')}
          variant="secondary"
          onPress={async () => {
            const ok = await showConfirm(
              t('kickTitle'),
              t('kickMessage', { name: korisnik.fullName || korisnik.username }),
            )
            if (ok) kickMutation.mutate()
          }}
          loading={kickMutation.isPending}
          fullWidth
        />
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  section: { gap: spacing.md, marginBottom: spacing.xl },
})
