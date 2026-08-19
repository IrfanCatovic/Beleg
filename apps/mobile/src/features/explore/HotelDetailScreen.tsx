import { Image, Linking, ScrollView, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import {
  getApiErrorMessage,
  hotelPublicVisibleSections,
  isValidLatLng,
  normalizeInstagramUrl,
  safeHttpUrl,
} from '@beleg/shared'
import { fetchHotelById } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Button, Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import { FerrataDetailMapSection } from './ferrata/FerrataDetailMapSection'
import type { ExploreStackParamList, HomeStackParamList } from '../../navigation/types'

type Props =
  | NativeStackScreenProps<ExploreStackParamList, 'HotelDetail'>
  | NativeStackScreenProps<HomeStackParamList, 'HotelDetail'>

function openHttp(raw?: string | null) {
  const href = safeHttpUrl(raw)
  if (!href) return
  void Linking.openURL(href)
}

export default function HotelDetailScreen({ route }: Props) {
  const hotelId = route.params.hotelId
  const query = useQuery({
    queryKey: ['hotel', hotelId],
    queryFn: () => fetchHotelById(client, hotelId),
    enabled: Number.isInteger(hotelId) && hotelId > 0,
  })

  if (!Number.isInteger(hotelId) || hotelId <= 0) {
    return (
      <Screen edges={['left', 'right']}>
        <ErrorView message="Hotel nije pronađen" />
      </Screen>
    )
  }

  if (query.isLoading) {
    return (
      <Screen edges={['left', 'right']}>
        <Loader />
      </Screen>
    )
  }

  if (query.isError || !query.data) {
    return (
      <Screen edges={['left', 'right']}>
        <ErrorView
          message={getApiErrorMessage(query.error, 'Hotel nije pronađen')}
          onRetry={() => {
            void query.refetch()
          }}
        />
      </Screen>
    )
  }

  const hotel = query.data
  const sections = hotelPublicVisibleSections(hotel)
  const cover = hotel.slike?.find((u) => u?.trim())?.trim()
  const bookingHref = safeHttpUrl(hotel.bookingUrl)
  const instagramHref = normalizeInstagramUrl(hotel.instagramUrl)
  const hasMap = isValidLatLng(hotel.lat, hotel.lng)

  return (
    <Screen edges={['left', 'right']} scroll>
      {cover ? (
        <Image source={{ uri: cover }} style={styles.hero} resizeMode="cover" />
      ) : (
        <View style={[styles.hero, styles.heroFallback]}>
          <Ionicons name="bed-outline" size={48} color={colors.brandLight} />
        </View>
      )}
      <Text variant="heading" style={styles.title}>
        {hotel.naziv}
      </Text>

      {sections.opis ? (
        <Card style={styles.card}>
          <Text variant="label">O hotelu</Text>
          <Text variant="body" style={styles.body}>
            {hotel.opis}
          </Text>
        </Card>
      ) : null}

      {sections.gallery ? (
        <Card style={styles.card}>
          <Text variant="label">Galerija</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
            {hotel.slike!.filter((u) => u.trim()).map((u) => (
              <Image key={u} source={{ uri: u }} style={styles.galleryImg} resizeMode="cover" />
            ))}
          </ScrollView>
        </Card>
      ) : null}

      {hasMap ? (
        <FerrataDetailMapSection lat={hotel.lat!} lng={hotel.lng!} naziv={hotel.naziv} subtitle="Lokacija" />
      ) : null}

      {sections.telefon ? (
        <Button title={`Pozovi: ${hotel.telefon}`} variant="secondary" onPress={() => void Linking.openURL(`tel:${hotel.telefon}`)} />
      ) : null}
      {bookingHref ? <Button title="Rezerviši" onPress={() => openHttp(bookingHref)} /> : null}
      {instagramHref ? (
        <Button title="Instagram" variant="secondary" onPress={() => openHttp(instagramHref)} />
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 180, borderRadius: radius.md, marginBottom: spacing.md, backgroundColor: colors.surfaceAlt },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  title: { marginBottom: spacing.md },
  card: { gap: spacing.sm, marginBottom: spacing.md },
  body: { color: colors.text },
  gallery: { gap: spacing.sm, paddingVertical: spacing.xs },
  galleryImg: { width: 140, height: 100, borderRadius: radius.sm },
})
