import { useLayoutEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { Korisnik } from '@beleg/shared'
import { fetchKorisnici } from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Avatar, Card, EmptyState, ErrorView, Input, Loader, Text } from '../../components/ui'
import { canManageClub } from '../../utils/roles'
import { getRoleLabel, getRoleColor } from '../../utils/profileRank'
import { colors, spacing } from '../../theme'
import type { ClubStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ClubStackParamList, 'ClubManageUsers'>

const ROLE_FILTERS = ['', 'clan', 'vodic', 'admin', 'sekretar', 'blagajnik', 'menadzer-opreme']

export default function ClubManageUsersScreen({ navigation }: Props) {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const canManage = canManageClub(user, user?.klubId)

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        canManage ? (
          <Pressable
            onPress={() => navigation.navigate('RegisterClubMember')}
            hitSlop={8}
            style={styles.headerBtn}
          >
            <Ionicons name="person-add-outline" size={22} color="#fff" />
          </Pressable>
        ) : null,
    })
  }, [navigation, canManage])

  const membersQuery = useQuery({
    queryKey: ['korisnici', 'club-manage'],
    queryFn: () => fetchKorisnici(client, { scope: 'club' }),
    enabled: canManage,
  })

  const filtered = useMemo(() => {
    let list = membersQuery.data ?? []
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (k) =>
          k.username.toLowerCase().includes(q) ||
          (k.fullName ?? '').toLowerCase().includes(q),
      )
    }
    if (roleFilter) list = list.filter((k) => k.role === roleFilter)
    return list
  }, [membersQuery.data, search, roleFilter])

  if (!canManage) {
    return (
      <View style={styles.centered}>
        <Text color={colors.textMuted}>Nemate dozvolu za upravljanje članovima.</Text>
      </View>
    )
  }

  if (membersQuery.isLoading) return <Loader />
  if (membersQuery.isError) {
    return <ErrorView message="Članovi nisu učitani." onRetry={() => membersQuery.refetch()} />
  }

  return (
    <View style={styles.root}>
      <View style={styles.filters}>
        <Input placeholder="Pretraži…" value={search} onChangeText={setSearch} autoCapitalize="none" />
        <FlatList
          horizontal
          data={ROLE_FILTERS}
          keyExtractor={(r) => r || 'all'}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roleRow}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setRoleFilter(item)}
              style={[styles.roleChip, roleFilter === item && styles.roleChipActive]}
            >
              <Text variant="small" color={roleFilter === item ? '#fff' : colors.text}>
                {item ? getRoleLabel(item) : 'Sve uloge'}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={membersQuery.isFetching} onRefresh={() => membersQuery.refetch()} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="Nema članova" />}
        renderItem={({ item }) => (
          <MemberRow korisnik={item} onPress={() => navigation.navigate('ClubMemberAdmin', { id: item.id })} />
        )}
      />
    </View>
  )
}

function MemberRow({ korisnik, onPress }: { korisnik: Korisnik; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.row}>
        <Avatar uri={korisnik.avatar_url} name={korisnik.fullName || korisnik.username} size={44} />
        <View style={styles.rowInfo}>
          <Text variant="label">{korisnik.fullName || korisnik.username}</Text>
          <Text variant="small" color={colors.textMuted}>@{korisnik.username}</Text>
        </View>
        {korisnik.role ? (
          <View style={[styles.badge, { backgroundColor: getRoleColor(korisnik.role) }]}>
            <Text variant="small" color="#fff">{getRoleLabel(korisnik.role)}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  filters: { padding: spacing.md, gap: spacing.sm },
  roleRow: { gap: spacing.sm },
  roleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowInfo: { flex: 1 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
  headerBtn: { marginRight: spacing.sm },
})
