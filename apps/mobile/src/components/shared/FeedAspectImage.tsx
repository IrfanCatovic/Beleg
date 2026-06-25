import { useEffect, useState, type ReactNode } from 'react'
import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { colors } from '../../theme'

const DEFAULT_MAX_HEIGHT = 520
const DEFAULT_MIN_HEIGHT = 120

type FeedAspectImageProps = {
  uri: string
  maxHeight?: number
  minHeight?: number
  borderRadius?: number
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

/**
 * Feed slika sa visinom iz originalnog odnosa stranica (Instagram/Facebook pristup):
 * puna širina, visina izmerena iz dimenzija, ograničena max visinom da ne zauzme ceo ekran.
 */
export function FeedAspectImage({
  uri,
  maxHeight = DEFAULT_MAX_HEIGHT,
  minHeight = DEFAULT_MIN_HEIGHT,
  borderRadius = 0,
  style,
  children,
}: FeedAspectImageProps) {
  const [layoutWidth, setLayoutWidth] = useState(0)
  const [height, setHeight] = useState<number | null>(null)

  useEffect(() => {
    if (!uri || layoutWidth <= 0) {
      setHeight(null)
      return
    }

    let cancelled = false
    Image.getSize(
      uri,
      (w, h) => {
        if (cancelled) return
        if (w <= 0 || h <= 0) {
          setHeight(minHeight)
          return
        }
        const naturalHeight = layoutWidth * (h / w)
        setHeight(Math.min(maxHeight, Math.max(minHeight, naturalHeight)))
      },
      () => {
        if (!cancelled) setHeight(minHeight)
      },
    )

    return () => {
      cancelled = true
    }
  }, [uri, layoutWidth, maxHeight, minHeight])

  const displayHeight = height ?? minHeight

  return (
    <View
      style={[styles.wrap, { height: displayHeight, borderRadius }, style]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width
        if (w > 0 && w !== layoutWidth) setLayoutWidth(w)
      }}
    >
      <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
})
