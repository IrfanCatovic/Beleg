import { FlatList, Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import type { UspesnaAkcija } from '@beleg/shared'
import { Text } from '../../components/ui'
import { colors, spacing } from '../../theme'

interface ProfileActionGridProps {
  actions: UspesnaAkcija[]
  onPressAction: (id: number) => void
}

const GAP = spacing.xs

export function ProfileActionGrid({ actions, onPressAction }: ProfileActionGridProps) {
  const { width } = useWindowDimensions()
  const tileSize = (width - spacing.lg * 2 - GAP * 2) / 3

  return (
    <FlatList
      data={actions}
      keyExtractor={(item) => String(item.id)}
      numColumns={3}
      scrollEnabled={false}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      renderItem={({ item }) => (
        <Pressable style={[styles.tile, { width: tileSize }]} onPress={() => onPressAction(item.id)}>
          <View style={[styles.imageWrap, { width: tileSize, height: tileSize }]}>
            {item.slikaUrl ? (
              <Image source={{ uri: item.slikaUrl }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.fallback]} />
            )}
          </View>
          <Text variant="small" numberOfLines={2} style={styles.name}>
            {item.naziv}
          </Text>
        </Pressable>
      )}
    />
  )
}

const styles = StyleSheet.create({
  grid: { gap: GAP },
  row: { gap: GAP, marginBottom: GAP },
  tile: { gap: spacing.xs },
  imageWrap: { borderRadius: 6, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  fallback: { backgroundColor: colors.brand },
  image: { width: '100%', height: '100%' },
  name: { lineHeight: 16 },
})
