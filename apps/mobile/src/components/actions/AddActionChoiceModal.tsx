import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { ActionKind } from '@beleg/shared'
import { Button, Text } from '../ui'
import { colors, radius, spacing } from '../../theme'

type Step = 'type' | 'kind'

interface AddActionChoiceModalProps {
  visible: boolean
  onClose: () => void
  onPickNova: (tip: ActionKind) => void
  onPickProsla: (tip: ActionKind) => void
}

export function AddActionChoiceModal({
  visible,
  onClose,
  onPickNova,
  onPickProsla,
}: AddActionChoiceModalProps) {
  const [step, setStep] = useState<Step>('type')
  const [tip, setTip] = useState<ActionKind | null>(null)

  useEffect(() => {
    if (visible) {
      setStep('type')
      setTip(null)
    }
  }, [visible])

  const pickType = (t: ActionKind) => {
    setTip(t)
    setStep('kind')
  }

  const back = () => {
    setStep('type')
    setTip(null)
  }

  const handleNova = () => {
    if (!tip) return
    onPickNova(tip)
    onClose()
  }

  const handleProsla = () => {
    if (!tip) return
    onPickProsla(tip)
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text variant="label">{step === 'type' ? 'Tip akcije' : 'Nova ili prošla akcija'}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {step === 'type' ? (
            <View style={styles.options}>
              <Text variant="small" color={colors.textMuted} style={styles.hint}>
                Izaberite da li je akcija planinarska ili via ferrata.
              </Text>
              <ChoiceButton icon="trail-sign-outline" label="Planina" onPress={() => pickType('planina')} />
              <ChoiceButton icon="link-outline" label="Via ferrata" onPress={() => pickType('via_ferrata')} />
            </View>
          ) : tip ? (
            <View style={styles.options}>
              <Pressable onPress={back} style={styles.backRow}>
                <Ionicons name="arrow-back" size={18} color={colors.brand} />
                <Text variant="small" color={colors.brand}>
                  Nazad
                </Text>
              </Pressable>
              <Text variant="small" color={colors.textMuted} style={styles.hint}>
                {tip === 'via_ferrata' ? 'Via ferrata' : 'Planina'} — šta želite da dodate?
              </Text>
              <Button title="Nova akcija" onPress={handleNova} fullWidth />
              <Button title="Prošla akcija" variant="secondary" onPress={handleProsla} fullWidth />
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function ChoiceButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={styles.choice}>
      <Ionicons name={icon} size={22} color={colors.brand} />
      <Text variant="label">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.chevron} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  hint: { marginBottom: spacing.sm },
  options: { gap: spacing.sm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chevron: { marginLeft: 'auto' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
})
