import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import type { UspesnaAkcija } from '@beleg/shared'
import { computePERForAkcija } from '@beleg/shared/utils'
import { Text } from '../../components/ui'
import { colors } from '../../theme'
import { actionCardAccessibilityLabel } from './profileEmptyStates'

interface ProfileActionGridProps {
  actions: UspesnaAkcija[]
  onPressAction: (id: number) => void
  /** Edge-to-edge 3 kolone bez naziva ispod slike. */
  fullWidth?: boolean
  mode?: 'climbed' | 'guided'
}

const GAP = 1
const COLS = 3

/** Profilni grid bez nested FlatList (ScrollView parent). */
export function ProfileActionGrid({
  actions,
  onPressAction,
  fullWidth = false,
  mode = 'climbed',
}: ProfileActionGridProps) {
  const { width } = useWindowDimensions()
  const tileSize = Math.floor((width - GAP * 2) / COLS)

  if (actions.length === 0) {
    return null
  }

  const rows: UspesnaAkcija[][] = []
  for (let i = 0; i < actions.length; i += COLS) {
    rows.push(actions.slice(i, i + COLS))
  }

  return (
    <View
      style={fullWidth ? styles.gridFull : styles.grid}
      accessibilityRole="summary"
      accessibilityLabel="Planinarska istorija"
    >
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={fullWidth ? styles.rowFull : styles.row}>
          {row.map((item) => {
            const per = computePERForAkcija(item)
            const label = actionCardAccessibilityLabel(item.naziv, per)

            return (
              <Pressable
                key={item.id}
                style={fullWidth ? { width: tileSize, height: tileSize, minHeight: 44 } : [styles.tile, { minHeight: 44 }]}
                onPress={() => onPressAction(item.id)}
                accessibilityRole="button"
                accessibilityLabel={label}
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
                    <Image
                      source={{ uri: item.slikaUrl }}
                      style={styles.image}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                      accessible={false}
                    />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.fallback]} accessible={false} />
                  )}
                  {per > 0 ? (
                    <View
                      style={[styles.perBadge, mode === 'guided' ? styles.perBadgeGuided : styles.perBadgeClimbed]}
                      accessible={false}
                    >
                      <Text style={styles.perText}>{per}</Text>
                    </View>
                  ) : null}
                </View>
                {!fullWidth ? (
                  <Text variant="small" numberOfLines={2} style={styles.name}>
                    {item.naziv}
                  </Text>
                ) : null}
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  gridFull: { gap: GAP },
  grid: { gap: 8 },
  rowFull: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tile: { gap: 4, flex: 1 },
  imageWrap: { overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  fallback: { backgroundColor: colors.brand },
  image: { width: '100%', height: '100%' },
  name: { lineHeight: 16 },
  perBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    minWidth: 22,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perBadgeClimbed: { backgroundColor: 'rgba(16, 185, 129, 0.95)' },
  perBadgeGuided: { backgroundColor: 'rgba(124, 58, 237, 0.95)' },
  perText: { color: '#fff', fontSize: 9, fontWeight: '800', lineHeight: 11 },
})
