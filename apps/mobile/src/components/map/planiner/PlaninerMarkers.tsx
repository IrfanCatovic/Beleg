import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Path } from 'react-native-svg'
import { colors } from '../../../theme'

const SIZES = {
  ferrata: 48,
  hotel: 44,
  peak: 44,
} as const

const GRADIENTS = {
  ferrata: ['#34d399', '#059669', '#064e3b'] as const,
  hotel: ['#fcd34d', '#f59e0b', '#c2410c'] as const,
  peak: ['#7dd3fc', '#6366f1', '#3730a3'] as const,
}

const PULSE_COLORS = {
  ferrata: '#059669',
  hotel: '#f59e0b',
  peak: '#6366f1',
} as const

function MarkerShell({
  size,
  gradient,
  pulseColor,
  active,
  children,
}: {
  size: number
  gradient: readonly [string, string, ...string[]]
  pulseColor: string
  active?: boolean
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
          },
        ]}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
        <View style={styles.iconWrap}>{children}</View>
      </View>
    </View>
  )
}

function FerrataIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 18 L9 10 L12 14 L15 8 L19 18 Z"
        fill="#ffffff"
        fillOpacity={0.25}
        stroke="#ffffff"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path
        d="M11 5.5 C11 4.12 12.12 3 13.5 3 H14.2 C15.2 3 16 3.8 16 4.8 V9.5 C16 10.33 15.33 11 14.5 11 H13.5 C12.67 11 12 10.33 12 9.5 V7"
        stroke="#ffffff"
        strokeWidth={1.65}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 7 V11.5 C12 12.88 10.88 14 9.5 14 H8.8 C7.8 14 7 13.2 7 12.2 V7.5 C7 6.67 7.67 6 8.5 6 H9.5 C10.33 6 11 6.67 11 7.5"
        stroke="#ffffff"
        strokeWidth={1.65}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function PeakIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="m8 3 4 8 5-5 5 15H2L8 3z"
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function FerrataMapMarker({ active }: { active?: boolean }) {
  return (
    <MarkerShell
      size={SIZES.ferrata}
      gradient={GRADIENTS.ferrata}
      pulseColor={PULSE_COLORS.ferrata}
      active={active}
    >
      <FerrataIcon />
    </MarkerShell>
  )
}

export function HotelMapMarker({ active }: { active?: boolean }) {
  return (
    <MarkerShell
      size={SIZES.hotel}
      gradient={GRADIENTS.hotel}
      pulseColor={PULSE_COLORS.hotel}
      active={active}
    >
      <Ionicons name="bed" size={20} color={colors.white} />
    </MarkerShell>
  )
}

export function PeakMapMarker({ active }: { active?: boolean }) {
  return (
    <MarkerShell
      size={SIZES.peak}
      gradient={GRADIENTS.peak}
      pulseColor={PULSE_COLORS.peak}
      active={active}
    >
      <PeakIcon />
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
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
