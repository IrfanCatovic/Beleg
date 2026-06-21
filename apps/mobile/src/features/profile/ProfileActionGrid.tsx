import { FlatList, Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import type { UspesnaAkcija } from '@beleg/shared'
import { Text } from '../../components/ui'
import { colors } from '../../theme'

interface ProfileActionGridProps {
  actions: UspesnaAkcija[]
  onPressAction: (id: number) => void
  /** Edge-to-edge 3 kolone bez naziva ispod slike. */
  fullWidth?: boolean
}

const GAP = 1

export function ProfileActionGrid({ actions, onPressAction, fullWidth = false }: ProfileActionGridProps) {
  const { width } = useWindowDimensions()
  const tileSize = Math.floor((width - GAP * 2) / 3)

  if (actions.length === 0) {
    return (
      <View style={styles.empty}>
        <Text color={colors.textMuted}>Nema akcija.</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={actions}
      keyExtractor={(item) => String(item.id)}
      numColumns={3}
      scrollEnabled={false}
      columnWrapperStyle={fullWidth ? styles.rowFull : styles.row}
      contentContainerStyle={fullWidth ? styles.gridFull : styles.grid}
      renderItem={({ item }) => (
        <Pressable
          style={fullWidth ? { width: tileSize, height: tileSize } : styles.tile}
          onPress={() => onPressAction(item.id)}
        >
          <View
            style={[
              styles.imageWrap,
              fullWidth
                ? { width: tileSize, height: tileSize }
                : { aspectRatio: 1, width: '100%' },
            ]}
          >
            {item.slikaUrl ? (
              <Image source={{ uri: item.slikaUrl }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.fallback]} />
            )}
          </View>
          {!fullWidth ? (
            <Text variant="small" numberOfLines={2} style={styles.name}>
              {item.naziv}
            </Text>
          ) : null}
        </Pressable>
      )}
    />
  )
}

const styles = StyleSheet.create({
  gridFull: { gap: GAP },
  grid: { gap: 8 },
  rowFull: { gap: GAP, marginBottom: GAP },
  row: { gap: 8, marginBottom: 8 },
  tile: { gap: 4 },
  imageWrap: { overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  fallback: { backgroundColor: colors.brand },
  image: { width: '100%', height: '100%' },
  name: { lineHeight: 16 },
  empty: { paddingVertical: 24, alignItems: 'center' },
})
