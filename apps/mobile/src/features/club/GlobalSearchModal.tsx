import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import type { AkcijaListItem, KlubData, Korisnik } from '@beleg/shared'
import { fetchAkcije, fetchKorisnici, searchKlubovi } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Avatar, Input, SegmentedToggle, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'

type SearchTab = 'users' | 'actions' | 'clubs'

interface GlobalSearchModalProps {
  visible: boolean
  onClose: () => void
  onSelectUser: (user: Korisnik) => void
  onSelectAction: (action: AkcijaListItem) => void
  onSelectClub?: (club: KlubData) => void
  /** Kada je true, korisnici se traže samo u klubu. */
  clubMembersOnly?: boolean
  showClubs?: boolean
}

function matchesQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.toLowerCase())
}

export function GlobalSearchModal({
  visible,
  onClose,
  onSelectUser,
  onSelectAction,
  onSelectClub,
  clubMembersOnly = false,
  showClubs = true,
}: GlobalSearchModalProps) {
  const [tab, setTab] = useState<SearchTab>('users')
  const [query, setQuery] = useState('')

  const usersQuery = useQuery({
    queryKey: ['korisnici', clubMembersOnly ? 'club-search' : 'global-search'],
    queryFn: () => fetchKorisnici(client, { scope: clubMembersOnly ? 'club' : 'global' }),
    enabled: visible,
  })

  const akcijeQuery = useQuery({
    queryKey: ['akcije', 'global-search'],
    queryFn: () => fetchAkcije(client),
    enabled: visible && !clubMembersOnly,
  })

  const clubsQuery = useQuery({
    queryKey: ['klubovi', 'search', query],
    queryFn: () => searchKlubovi(client, query.trim() || undefined),
    enabled: visible && showClubs && !clubMembersOnly,
  })

  const tabOptions = useMemo(() => {
    const opts: { value: SearchTab; label: string }[] = [
      { value: 'users', label: clubMembersOnly ? 'Članovi' : 'Korisnici' },
    ]
    if (!clubMembersOnly) {
      opts.push({ value: 'actions', label: 'Akcije' })
      if (showClubs) opts.push({ value: 'clubs', label: 'Klubovi' })
    }
    return opts
  }, [clubMembersOnly, showClubs])

  const filteredUsers = useMemo(() => {
    const q = query.trim()
    const list = usersQuery.data ?? []
    if (!q) return list.slice(0, 30)
    return list
      .filter((u) =>
        matchesQuery([u.fullName, u.username, u.email].filter(Boolean).join(' '), q),
      )
      .slice(0, 50)
  }, [query, usersQuery.data])

  const filteredActions = useMemo(() => {
    const q = query.trim()
    const data = akcijeQuery.data
    if (!data) return [] as AkcijaListItem[]
    const all = [
      ...(data.aktivne ?? []),
      ...(data.zavrsene ?? []),
      ...(data.vodeneAktivne ?? []),
      ...(data.vodeneZavrsene ?? []),
      ...(data.mojePrivatneAktivne ?? []),
      ...(data.mojePrivatneZavrsene ?? []),
    ]
    const byId = new Map<number, AkcijaListItem>()
    for (const a of all) byId.set(a.id, a)
    const unique = [...byId.values()]
    if (!q) return unique.slice(0, 30)
    return unique
      .filter((a) => matchesQuery([a.naziv, a.planina, a.vrh].filter(Boolean).join(' '), q))
      .slice(0, 50)
  }, [akcijeQuery.data, query])

  const filteredClubs = useMemo(() => {
    const q = query.trim()
    const list = clubsQuery.data?.klubovi ?? []
    if (!q) return list.slice(0, 20)
    return list
      .filter((c) => matchesQuery([c.naziv, c.sediste, c.adresa].filter(Boolean).join(' '), q))
      .slice(0, 30)
  }, [clubsQuery.data, query])

  const handleClose = () => {
    setQuery('')
    setTab('users')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text variant="label">Pretraga</Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Pretraži..."
            autoCapitalize="none"
            autoCorrect={false}
          />

          {tabOptions.length > 1 ? (
            <SegmentedToggle options={tabOptions} value={tab} onChange={setTab} />
          ) : null}

          {tab === 'users' ? (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <Text variant="body" color={colors.textMuted} style={styles.empty}>
                  {usersQuery.isLoading ? 'Učitavanje...' : 'Nema rezultata.'}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.row}
                  onPress={() => {
                    handleClose()
                    onSelectUser(item)
                  }}
                >
                  <Avatar uri={item.avatar_url} name={item.fullName || item.username} size={40} />
                  <View style={styles.rowText}>
                    <Text variant="label">{item.fullName || item.username}</Text>
                    <Text variant="small" color={colors.textMuted}>
                      @{item.username}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            />
          ) : null}

          {tab === 'actions' ? (
            <FlatList
              data={filteredActions}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <Text variant="body" color={colors.textMuted} style={styles.empty}>
                  {akcijeQuery.isLoading ? 'Učitavanje...' : 'Nema rezultata.'}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.row}
                  onPress={() => {
                    handleClose()
                    onSelectAction(item)
                  }}
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name="trail-sign-outline" size={20} color={colors.brand} />
                  </View>
                  <View style={styles.rowText}>
                    <Text variant="label">{item.naziv}</Text>
                    <Text variant="small" color={colors.textMuted}>
                      {[item.planina, item.datum].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            />
          ) : null}

          {tab === 'clubs' ? (
            <FlatList
              data={filteredClubs}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <Text variant="body" color={colors.textMuted} style={styles.empty}>
                  {clubsQuery.isLoading ? 'Učitavanje...' : 'Nema klubova.'}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.row}
                  onPress={() => {
                    handleClose()
                    onSelectClub?.(item)
                  }}
                >
                  <Avatar uri={item.logoUrl} name={item.naziv} size={40} />
                  <View style={styles.rowText}>
                    <Text variant="label">{item.naziv}</Text>
                    <Text variant="small" color={colors.textMuted}>
                      {item.sediste || item.adresa || 'Planinarski klub'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  body: { flex: 1, padding: spacing.lg, gap: spacing.md },
  list: { paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1, gap: 2 },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { paddingTop: spacing.xl, textAlign: 'center' },
})
