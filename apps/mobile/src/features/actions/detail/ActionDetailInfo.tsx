import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AkcijaDetail } from '@beleg/shared'
import { computePERForAkcija, formatActionDate } from '@beleg/shared'
import { Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface ActionDetailInfoProps {
  akcija: AkcijaDetail
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}) {
  if (!value || value === '—') return null
  return (
    <View style={styles.row}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={16} color={colors.brand} />
      </View>
      <View style={styles.rowText}>
        <Text variant="small" color={colors.textMuted}>
          {label}
        </Text>
        <Text variant="body">{value}</Text>
      </View>
    </View>
  )
}

export function ActionDetailInfo({ akcija }: ActionDetailInfoProps) {
  const isFerrata = akcija.tipAkcije === 'via_ferrata'
  const actionPer = !isFerrata ? computePERForAkcija(akcija) : 0
  const dateStr = formatActionDate(akcija.datum)
  const rokStr = formatActionDate(akcija.rokPrijava, '')

  const guideName = akcija.vodic?.fullName || akcija.vodic?.username || akcija.drugiVodicIme

  return (
    <Card style={styles.card}>
      <Text variant="label">Detalji akcije</Text>
      {!isFerrata && akcija.planina ? (
        <InfoRow icon="triangle-outline" label="Planina" value={akcija.planina} />
      ) : null}
      {!isFerrata && akcija.vrh ? <InfoRow icon="flag-outline" label="Vrh" value={akcija.vrh} /> : null}
      {!isFerrata && akcija.duzinaStazeKm != null && akcija.duzinaStazeKm > 0 ? (
        <InfoRow
          icon="resize-outline"
          label="Dužina staze"
          value={`${akcija.duzinaStazeKm.toFixed(1)} km`}
        />
      ) : null}
      {!isFerrata && akcija.kumulativniUsponM != null && akcija.kumulativniUsponM > 0 ? (
        <InfoRow icon="trending-up-outline" label="Uspon" value={`${akcija.kumulativniUsponM} m`} />
      ) : null}
      {!isFerrata && akcija.visinaVrhM != null && akcija.visinaVrhM > 0 ? (
        <InfoRow icon="arrow-up-outline" label="Visina vrha" value={`${akcija.visinaVrhM} m`} />
      ) : null}
      {!isFerrata && actionPer > 0 ? (
        <InfoRow icon="star-outline" label="PER" value={String(actionPer)} />
      ) : null}
      <InfoRow icon="calendar-outline" label="Datum akcije" value={dateStr} />
      <InfoRow icon="person-outline" label="Vodič" value={guideName || ''} />
      <InfoRow icon="business-outline" label="Klub" value={akcija.klubNaziv || ''} />
      <InfoRow icon="fitness-outline" label="Težina" value={akcija.tezina || ''} />
      <InfoRow icon="navigate-outline" label="Polazak" value={akcija.mestoPolaska || ''} />
      <InfoRow icon="time-outline" label="Rok za prijavu" value={rokStr} />
      {akcija.opis ? (
        <View style={styles.desc}>
          <Text variant="small" color={colors.textMuted}>
            Opis
          </Text>
          <Text variant="body" color={colors.textMuted}>
            {akcija.opis}
          </Text>
        </View>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  desc: { marginTop: spacing.sm, gap: spacing.xs },
})
