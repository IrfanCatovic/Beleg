import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import type { HotelNearbyPublic } from '@beleg/shared'
import { Button, Card, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import { FerrataDetailMapSection } from './FerrataDetailMapSection'

interface FerrataHotelsSectionProps {
  hotels: HotelNearbyPublic[]
  loading?: boolean
}

function hotelThumb(h: HotelNearbyPublic): string | null {
  const fromGallery = h.slike?.find((x) => x?.trim())?.trim()
  if (fromGallery) return fromGallery
  if (h.coverImage?.trim()) return h.coverImage.trim()
  return null
}

function formatDistanceKm(km: number | undefined): string {
  if (km == null || !Number.isFinite(km)) return '—'
  const rounded = Math.round(km * 10) / 10
  return String(rounded).replace(/\.0$/, '')
}

export function FerrataHotelsSection({ hotels, loading }: FerrataHotelsSectionProps) {
  const [selected, setSelected] = useState<HotelNearbyPublic | null>(null)
  const [imgIx, setImgIx] = useState(0)

  useEffect(() => {
    setImgIx(0)
  }, [selected?.id])

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

  const selectedImages =
    selected?.slike?.map((x) => x.trim()).filter(Boolean) ??
    (selected?.coverImage?.trim() ? [selected.coverImage.trim()] : [])
  const mainImage = selectedImages[imgIx % Math.max(selectedImages.length, 1)] ?? null

  return (
    <>
      <Card style={styles.card}>
        <SectionTitle icon="bed-outline" title="Hoteli u blizini" />
        <Text variant="small" color={colors.textMuted}>
          Smeštaj u blizini ferate — gde možete da ostanete pre ili posle uspona.
        </Text>
        <View style={styles.list}>
          {hotels.slice(0, 8).map((h) => (
            <HotelCard key={h.id} hotel={h} onPress={() => setSelected(h)} />
          ))}
        </View>
      </Card>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {selected ? (
              <ScrollView
                contentContainerStyle={styles.sheetContent}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                <View style={styles.sheetHeader}>
                  <Text variant="heading">{selected.naziv || 'Hotel'}</Text>
                  <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                    <Ionicons name="close" size={24} color={colors.textMuted} />
                  </Pressable>
                </View>

                <View style={styles.galleryRow}>
                  <View style={styles.mainImageWrap}>
                    {mainImage ? (
                      <Image source={{ uri: mainImage }} style={styles.mainImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.mainImage, styles.imageFallback]}>
                        <Ionicons name="bed-outline" size={40} color={colors.brandLight} />
                      </View>
                    )}
                  </View>
                  {selectedImages.length > 1 ? (
                    <ScrollView style={styles.thumbs} showsVerticalScrollIndicator={false}>
                      {selectedImages.map((url, ix) => (
                        <Pressable
                          key={`${url}-${ix}`}
                          onPress={() => setImgIx(ix)}
                          style={[styles.thumb, ix === imgIx && styles.thumbActive]}
                        >
                          <Image source={{ uri: url }} style={styles.thumbImage} resizeMode="cover" />
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>

                {selected.distanceKm != null ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={16} color={colors.brand} />
                    <Text variant="small" color={colors.textMuted}>
                      {formatDistanceKm(selected.distanceKm)} km od ferate
                    </Text>
                  </View>
                ) : null}

                {selected.opis ? (
                  <Text variant="body" color={colors.textMuted}>
                    {selected.opis}
                  </Text>
                ) : null}

                {typeof selected.lat === 'number' && typeof selected.lng === 'number' ? (
                  <FerrataDetailMapSection
                    embed
                    lat={selected.lat}
                    lng={selected.lng}
                    naziv={selected.naziv}
                  />
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
                {(selected.instagramUrl || selected.instagram) ? (
                  <Button
                    title="Instagram profil"
                    variant="secondary"
                    onPress={() =>
                      void Linking.openURL(String(selected.instagramUrl || selected.instagram))
                    }
                  />
                ) : null}
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

function HotelCard({ hotel, onPress }: { hotel: HotelNearbyPublic; onPress: () => void }) {
  const thumb = hotelThumb(hotel)
  const title = hotel.naziv?.trim() || 'Hotel'

  return (
    <Pressable style={styles.hotelCard} onPress={onPress}>
      <View style={styles.hotelThumbWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.hotelThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.hotelThumb, styles.imageFallback]}>
            <Ionicons name="bed-outline" size={28} color={colors.brandLight} />
          </View>
        )}
      </View>
      <View style={styles.hotelInfo}>
        <Text variant="label" numberOfLines={2}>
          {title}
        </Text>
        {hotel.distanceKm != null ? (
          <View style={styles.distanceRow}>
            <Ionicons name="location-outline" size={14} color={colors.brand} />
            <Text variant="small" color={colors.textMuted}>
              {formatDistanceKm(hotel.distanceKm)} km
            </Text>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
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
  list: { gap: spacing.sm, marginTop: spacing.xs },
  hotelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  hotelThumbWrap: {
    width: 88,
    height: 72,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  hotelThumb: { width: '100%', height: '100%' },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
  },
  hotelInfo: { flex: 1, gap: spacing.xs },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  sheetContent: { padding: spacing.lg, gap: spacing.md },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  galleryRow: { flexDirection: 'row', gap: spacing.sm },
  mainImageWrap: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  mainImage: { width: '100%', height: 180 },
  thumbs: { width: 72, maxHeight: 180 },
  thumb: {
    width: 72,
    height: 56,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbActive: { borderColor: colors.brand },
  thumbImage: { width: '100%', height: '100%' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
})
