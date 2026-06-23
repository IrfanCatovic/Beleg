import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
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

type Props = NativeStackScreenProps<ClubStackParamList, 'ClubMemberAdmin'>

const EDITABLE_ROLES = ['clan', 'vodic', 'blagajnik', 'sekretar', 'menadzer-opreme', 'admin'] as const

export default function ClubMemberAdminScreen({ route, navigation }: Props) {
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
      await queryClient.invalidateQueries({ queryKey: ['korisnici'] })
      await showAlert('Uspeh', 'Uloga je sačuvana.')
      navigation.goBack()
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Čuvanje nije uspelo.')),
  })

  const kickMutation = useMutation({
    mutationFn: () => removeClubMember(client, id, ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['korisnici'] })
      await showAlert('Gotovo', 'Član je uklonjen iz kluba.')
      navigation.goBack()
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Uklanjanje nije uspelo.')),
  })

  if (!canManage) {
    return (
      <Screen>
        <Text color={colors.textMuted}>Nemate dozvolu.</Text>
      </Screen>
    )
  }

  if (memberQuery.isLoading) return <Screen><Loader /></Screen>
  if (memberQuery.isError || !korisnik) {
    return <Screen><ErrorView message="Korisnik nije učitan." onRetry={() => memberQuery.refetch()} /></Screen>
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
          label="Uloga"
          options={EDITABLE_ROLES.map((r) => ({ value: r, label: getRoleLabel(r) }))}
          value={role}
          onChange={setRole}
          disabled={isSelf}
        />
        {!isSelf ? (
          <Button
            title="Sačuvaj ulogu"
            onPress={() => saveRoleMutation.mutate()}
            loading={saveRoleMutation.isPending}
            fullWidth
          />
        ) : (
          <Text variant="small" color={colors.textMuted}>Sopstvenu ulogu ne možete menjati ovde.</Text>
        )}
      </View>

      {!isSelf ? (
        <Button
          title="Izbaci iz kluba"
          variant="secondary"
          onPress={async () => {
            const ok = await showConfirm(
              'Izbaci člana',
              `Da li želite da uklonite ${korisnik.fullName || korisnik.username} iz kluba?`,
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
