import { Image, StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { colors, fontWeight } from '../../theme'

interface AvatarProps {
  uri?: string | null
  name?: string
  size?: number
}

export function Avatar({ uri, name, size = 44 }: AvatarProps) {
  const dimension = { width: size, height: size, borderRadius: size / 2 }
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?'

  if (uri) {
    return <Image source={{ uri }} style={[styles.img, dimension]} />
  }
  return (
    <View style={[styles.fallback, dimension]}>
      <Text color={colors.white} style={{ fontSize: size * 0.4, fontWeight: fontWeight.bold }}>
        {initial}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  img: { backgroundColor: colors.surfaceAlt },
  fallback: {
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
