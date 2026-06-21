import { useEffect, useState } from 'react'
import { Linking, Pressable, StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getApiErrorMessage } from '@beleg/shared'
import type { ClubAdminStats, ClubJoinRequestItem, KlubData } from '@beleg/shared'
import {
  fetchClubJoinRequests,
  fetchKlub,
  fetchKlubAdminStats,
  leaveClub,
  respondClubJoinRequest,
  updateKlub,
} from '@beleg/shared/services'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Avatar, Button, Card, ErrorView, Input, Loader, Screen, Text } from '../../components/ui'
import { canManageClub, hasClubContext } from '../../utils/roles'
import { colors, spacing } from '../../theme'
import NoClubJoinView from './NoClubJoinView'
import type { ClubStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ClubStackParamList, 'ClubHome'>
type Tab = 'public' | 'admin'

interface ClubForm {
  naziv: string
  adresa: string
  telefon: string
  email: string
  maticni_broj: string
  pib: string
  ziro_racun: string
  sediste: string
  web_sajt: string
  datum_osnivanja: string
}

export default function ClubScreen(_props: Props) {
  const { user, refreshUser } = useAuth()
  const { showConfirm, showAlert } = useModal()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('public')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ClubForm>({
    naziv: '',
    adresa: '',
    telefon: '',
    email: '',
    maticni_broj: '',
    pib: '',
    ziro_racun: '',
    sediste: '',
    web_sajt: '',
    datum_osnivanja: '',
  })

  const klubQuery = useQuery({
    queryKey: ['klub'],
    queryFn: () => fetchKlub(client),
    enabled: hasClubContext(user),
  })

  const klub = klubQuery.data
  const canManage = canManageClub(user, klub?.id)

  const adminStatsQuery = useQuery({
    queryKey: ['klub', 'admin-stats'],
    queryFn: () => fetchKlubAdminStats(client),
    enabled: !!klub?.id && canManage,
  })

  const joinRequestsQuery = useQuery({
    queryKey: ['klub', 'join-requests'],
    queryFn: () => fetchClubJoinRequests(client, 'pending'),
    enabled: !!klub?.id && canManage,
  })

  useEffect(() => {
    if (!klub) return
    setForm({
      naziv: klub.naziv ?? '',
      adresa: klub.adresa ?? '',
      telefon: klub.telefon ?? '',
      email: klub.email ?? '',
      maticni_broj: klub.maticni_broj ?? '',
      pib: klub.pib ?? '',
      ziro_racun: klub.ziro_racun ?? '',
      sediste: klub.sediste ?? '',
      web_sajt: klub.web_sajt ?? '',
      datum_osnivanja: klub.datum_osnivanja ? String(klub.datum_osnivanja).slice(0, 10) : '',
    })
  }, [klub])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {}
      if (form.naziv.trim()) payload.naziv = form.naziv.trim()
      payload.adresa = form.adresa
      payload.telefon = form.telefon
      payload.email = form.email
      payload.maticni_broj = form.maticni_broj
      payload.pib = form.pib
      payload.ziro_racun = form.ziro_racun
      payload.sediste = form.sediste
      payload.web_sajt = form.web_sajt
      if (form.datum_osnivanja) payload.datum_osnivanja = form.datum_osnivanja
      return updateKlub(client, payload)
    },
    onSuccess: async () => {
      setEditing(false)
      await queryClient.invalidateQueries({ queryKey: ['klub'] })
      await showAlert('Uspeh', 'Podaci kluba su sačuvani.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Čuvanje nije uspelo.')),
  })

  const joinRequestMutation = useMutation({
    mutationFn: ({ requestId, action }: { requestId: number; action: 'accept' | 'reject' | 'block' }) =>
      respondClubJoinRequest(client, requestId, action),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['klub', 'join-requests'] })
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Akcija nije uspela.')),
  })

  const leaveMutation = useMutation({
    mutationFn: () => leaveClub(client),
    onSuccess: async () => {
      await refreshUser()
      void queryClient.invalidateQueries({ queryKey: ['klub'] })
      await showAlert('Uspeh', 'Napustili ste klub.')
    },
    onError: (err) => showAlert('Greška', getApiErrorMessage(err, 'Napuštanje nije uspelo.')),
  })

  if (!hasClubContext(user)) {
    return (
      <Screen scroll>
        <NoClubJoinView />
      </Screen>
    )
  }

  if (klubQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (klubQuery.isError || !klub) {
    return (
      <Screen>
        <ErrorView message="Podaci o klubu nisu učitani." onRetry={() => klubQuery.refetch()} />
      </Screen>
    )
  }

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Avatar uri={klub.logoUrl} name={klub.naziv} size={72} />
        <View style={styles.heroText}>
          <Text variant="title">{klub.naziv}</Text>
          {klub.sediste ? <Text color={colors.textMuted}>{klub.sediste}</Text> : null}
        </View>
      </View>

      {canManage ? (
        <View style={styles.tabs}>
          <TabButton label="Javno" active={activeTab === 'public'} onPress={() => setActiveTab('public')} />
          <TabButton label="Admin" active={activeTab === 'admin'} onPress={() => setActiveTab('admin')} />
        </View>
      ) : null}

      {activeTab === 'public' || !canManage ? (
        <PublicTab klub={klub} />
      ) : (
        <AdminTab
          klub={klub}
          editing={editing}
          form={form}
          onFormChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onEdit={() => setEditing(true)}
          onCancel={() => setEditing(false)}
          onSave={() => saveMutation.mutate()}
          saving={saveMutation.isPending}
          stats={adminStatsQuery.data}
          statsLoading={adminStatsQuery.isLoading}
          joinRequests={joinRequestsQuery.data ?? []}
          joinRequestsLoading={joinRequestsQuery.isLoading}
          joinRequestBusy={joinRequestMutation.isPending}
          onJoinRequest={async (requestId, action) => {
            const labels = {
              accept: 'Prihvatiti zahtev?',
              reject: 'Odbiti zahtev?',
              block: 'Blokirati korisnika?',
            }
            const ok = await showConfirm('Zahtev za članstvo', labels[action])
            if (ok) joinRequestMutation.mutate({ requestId, action })
          }}
        />
      )}

      <View style={styles.leaveWrap}>
        <Button
          title="Napusti klub"
          variant="danger"
          onPress={async () => {
            const ok = await showConfirm('Napusti klub', 'Da li ste sigurni?')
            if (ok) leaveMutation.mutate()
          }}
          loading={leaveMutation.isPending}
          fullWidth
        />
      </View>
    </Screen>
  )
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text variant="label" color={active ? colors.brand : colors.textMuted}>
        {label}
      </Text>
    </Pressable>
  )
}

function PublicTab({ klub }: { klub: KlubData }) {
  return (
    <Card style={styles.section}>
      <ContactRow icon="location-outline" label="Adresa" value={klub.adresa} />
      <ContactRow icon="call-outline" label="Telefon" value={klub.telefon} href={klub.telefon ? `tel:${klub.telefon}` : undefined} />
      <ContactRow icon="mail-outline" label="Email" value={klub.email} href={klub.email ? `mailto:${klub.email}` : undefined} />
      <ContactRow
        icon="globe-outline"
        label="Web sajt"
        value={klub.web_sajt}
        href={klub.web_sajt ? (klub.web_sajt.startsWith('http') ? klub.web_sajt : `https://${klub.web_sajt}`) : undefined}
      />
      {klub.datum_osnivanja ? (
        <ContactRow icon="calendar-outline" label="Datum osnivanja" value={String(klub.datum_osnivanja).slice(0, 10)} />
      ) : null}
    </Card>
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
  value?: string
  href?: string
}) {
  if (!value) return null
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

function AdminTab({
  klub,
  editing,
  form,
  onFormChange,
  onEdit,
  onCancel,
  onSave,
  saving,
  stats,
  statsLoading,
  joinRequests,
  joinRequestsLoading,
  joinRequestBusy,
  onJoinRequest,
}: {
  klub: KlubData
  editing: boolean
  form: ClubForm
  onFormChange: (patch: Partial<ClubForm>) => void
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  stats?: ClubAdminStats
  statsLoading: boolean
  joinRequests: ClubJoinRequestItem[]
  joinRequestsLoading: boolean
  joinRequestBusy: boolean
  onJoinRequest: (requestId: number, action: 'accept' | 'reject' | 'block') => void
}) {
  return (
    <View style={styles.admin}>
      <Card style={styles.section}>
        <Text variant="label">Statistika</Text>
        {statsLoading ? (
          <Text color={colors.textMuted}>Učitavanje...</Text>
        ) : stats ? (
          <>
            <StatRow label="Aktivni članovi" value={`${stats.activeMembers} / ${stats.maxMembers}`} />
            <StatRow label="Administratori" value={`${stats.adminCount} / ${stats.maxAdmins}`} />
            <StatRow label="Storage" value={`${stats.usedStorageGb.toFixed(1)} / ${stats.maxStorageGb} GB`} />
            {stats.subscriptionEndsAt ? (
              <StatRow label="Pretplata do" value={String(stats.subscriptionEndsAt).slice(0, 10)} />
            ) : null}
          </>
        ) : (
          <Text color={colors.textMuted}>Statistika nije dostupna.</Text>
        )}
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="label">Podaci kluba</Text>
          {!editing ? (
            <Pressable onPress={onEdit}>
              <Text color={colors.brand}>Izmeni</Text>
            </Pressable>
          ) : null}
        </View>
        {editing ? (
          <>
            <Input label="Naziv" value={form.naziv} onChangeText={(v) => onFormChange({ naziv: v })} />
            <Input label="Sedište" value={form.sediste} onChangeText={(v) => onFormChange({ sediste: v })} />
            <Input label="Adresa" value={form.adresa} onChangeText={(v) => onFormChange({ adresa: v })} />
            <Input label="Telefon" value={form.telefon} onChangeText={(v) => onFormChange({ telefon: v })} />
            <Input label="Email" value={form.email} onChangeText={(v) => onFormChange({ email: v })} autoCapitalize="none" />
            <Input label="Matični broj" value={form.maticni_broj} onChangeText={(v) => onFormChange({ maticni_broj: v })} />
            <Input label="PIB" value={form.pib} onChangeText={(v) => onFormChange({ pib: v })} />
            <Input label="Žiro račun" value={form.ziro_racun} onChangeText={(v) => onFormChange({ ziro_racun: v })} />
            <Input label="Web sajt" value={form.web_sajt} onChangeText={(v) => onFormChange({ web_sajt: v })} autoCapitalize="none" />
            <Input
              label="Datum osnivanja"
              value={form.datum_osnivanja}
              onChangeText={(v) => onFormChange({ datum_osnivanja: v })}
              placeholder="YYYY-MM-DD"
            />
            <View style={styles.editActions}>
              <Button title="Sačuvaj" onPress={onSave} loading={saving} />
              <Button title="Otkaži" variant="secondary" onPress={onCancel} />
            </View>
          </>
        ) : (
          <>
            <StatRow label="Matični broj" value={klub.maticni_broj || '—'} />
            <StatRow label="PIB" value={klub.pib || '—'} />
            <StatRow label="Žiro račun" value={klub.ziro_racun || '—'} />
          </>
        )}
      </Card>

      <Card style={styles.section}>
        <Text variant="label">Zahtevi za članstvo</Text>
        {joinRequestsLoading ? (
          <Text color={colors.textMuted}>Učitavanje...</Text>
        ) : joinRequests.length === 0 ? (
          <Text color={colors.textMuted}>Nema aktivnih zahteva.</Text>
        ) : (
          joinRequests.map((req) => (
            <View key={req.id} style={styles.requestRow}>
              <View style={styles.requestInfo}>
                <Text variant="label">{req.fullName || req.username}</Text>
                <Text variant="small" color={colors.textMuted}>
                  @{req.username}
                </Text>
              </View>
              <View style={styles.requestActions}>
                <Pressable
                  disabled={joinRequestBusy}
                  onPress={() => onJoinRequest(req.id, 'accept')}
                  style={styles.requestBtn}
                >
                  <Ionicons name="checkmark-circle-outline" size={24} color={colors.brand} />
                </Pressable>
                <Pressable
                  disabled={joinRequestBusy}
                  onPress={() => onJoinRequest(req.id, 'reject')}
                  style={styles.requestBtn}
                >
                  <Ionicons name="close-circle-outline" size={24} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </Card>
    </View>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text variant="small" color={colors.textMuted}>
        {label}
      </Text>
      <Text>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  heroText: { flex: 1, justifyContent: 'center' },
  tabs: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    padding: 4,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: 6 },
  tabActive: { backgroundColor: colors.surface },
  section: { gap: spacing.sm, marginBottom: spacing.md },
  contactRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  contactText: { flex: 1, gap: 2 },
  contactPressable: { paddingVertical: spacing.xs },
  admin: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editActions: { gap: spacing.sm, marginTop: spacing.sm },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  requestInfo: { flex: 1 },
  requestActions: { flexDirection: 'row', gap: spacing.sm },
  requestBtn: { padding: spacing.xs },
  leaveWrap: { marginTop: spacing.lg },
})
