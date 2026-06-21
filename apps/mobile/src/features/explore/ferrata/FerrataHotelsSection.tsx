import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import type { HotelNearbyPublic } from '@beleg/shared'
import { Button, Card, Text } from '../../../components/ui'
import { colors, spacing } from '../../../theme'

interface FerrataHotelsSectionProps {
  hotels: HotelNearbyPublic[]
  loading?: boolean
}

export function FerrataHotelsSection({ hotels, loading }: FerrataHotelsSectionProps) {
  const [selected, setSelected] = useState<HotelNearbyPublic | null>(null)

  if (loading) {
    return (
      <Card style={styles.card}>
        <SectionTitle icon="bed-outline" title="Hoteli u blizini" />
        <Text variant="small" color={colors.textMuted}>
          Učitavanje...
        </Text>
      </Card>
    )
  }

  if (hotels.length === 0) return null

  return (
    <>
      <Card style={styles.card}>
        <SectionTitle icon="bed-outline" title="Hoteli u blizini" />
        {hotels.slice(0, 8).map((h) => (
          <Pressable key={h.id} style={styles.row} onPress={() => setSelected(h)}>
            <View style={styles.info}>
              <Text variant="label">{h.naziv}</Text>
              {h.distanceKm != null ? (
                <Text variant="small" color={colors.textMuted}>
                  {h.distanceKm.toFixed(1)} km
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </Card>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {selected ? (
              <>
                <Text variant="heading">{selected.naziv}</Text>
                {selected.opis ? (
                  <Text variant="body" color={colors.textMuted}>
                    {selected.opis}
                  </Text>
                ) : null}
                {selected.telefon ? (
                  <Button
                    title={`Pozovi: ${selected.telefon}`}
                    variant="secondary"
                    onPress={() => void Linking.openURL(`tel:${selected.telefon}`)}
                  />
                ) : null}
                {selected.bookingUrl ? (
                  <Button
                    title="Rezerviši (Booking)"
                    onPress={() => void Linking.openURL(String(selected.bookingUrl))}
                  />
                ) : null}
                <Button title="Zatvori" variant="ghost" onPress={() => setSelected(null)} />
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

function SectionTitle({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.titleRow}>
      <Ionicons name={icon} size={18} color={colors.brand} />
      <Text variant="label">{title}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  info: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: spacing.md,
  },
})
