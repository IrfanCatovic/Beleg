import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '../../ui'
import { colors, spacing } from '../../../theme'

const SIZES = {
  ferrata: 48,
  hotel: 44,
  peak: 44,
} as const

const COLORS = {
  ferrata: '#059669',
  ferrataDark: '#064e3b',
  hotel: '#f59e0b',
  hotelDark: '#c2410c',
  peak: '#6366f1',
  peakDark: '#3730a3',
} as const

function MarkerShell({
  size,
  bg,
  active,
  pulseColor,
  children,
}: {
  size: number
  bg: string
  active?: boolean
  pulseColor: string
  children: ReactNode
}) {
  return (
    <View style={[styles.wrap, active && styles.wrapActive]}>
      {active ? (
        <View style={[styles.pulse, { width: size + 16, height: size + 16, borderColor: pulseColor }]} />
      ) : null}
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bg,
          },
        ]}
      >
        {children}
      </View>
    </View>
  )
}

export function FerrataMapMarker({ active }: { active?: boolean }) {
  return (
    <MarkerShell size={SIZES.ferrata} bg={COLORS.ferrata} active={active} pulseColor={COLORS.ferrata}>
      <Ionicons name="link" size={22} color={colors.white} />
    </MarkerShell>
  )
}

export function HotelMapMarker({ active }: { active?: boolean }) {
  return (
    <MarkerShell size={SIZES.hotel} bg={COLORS.hotel} active={active} pulseColor={COLORS.hotel}>
      <Ionicons name="bed" size={20} color={colors.white} />
    </MarkerShell>
  )
}

export function PeakMapMarker({ active }: { active?: boolean }) {
  return (
    <MarkerShell size={SIZES.peak} bg={COLORS.peak} active={active} pulseColor={COLORS.peak}>
      <Ionicons name="triangle" size={20} color={colors.white} />
    </MarkerShell>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapActive: {
    transform: [{ scale: 1.06 }],
  },
  pulse: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    opacity: 0.45,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
})
