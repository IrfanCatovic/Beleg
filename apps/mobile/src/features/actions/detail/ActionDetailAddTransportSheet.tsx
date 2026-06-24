import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Switch, View } from 'react-native'
import { Button, Input, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'

interface ActionDetailAddTransportSheetProps {
  visible: boolean
  currency: string
  loading?: boolean
  onClose: () => void
  onSubmit: (data: {
    tipPrevoza: string
    nazivGrupe: string
    kapacitet: number
    cenaPoOsobi: number
    join: boolean
  }) => void | Promise<void>
}

export function ActionDetailAddTransportSheet({
  visible,
  currency,
  loading,
  onClose,
  onSubmit,
}: ActionDetailAddTransportSheetProps) {
  const [tipPrevoza, setTipPrevoza] = useState('')
  const [nazivGrupe, setNazivGrupe] = useState('')
  const [kapacitet, setKapacitet] = useState('4')
  const [cenaPoOsobi, setCenaPoOsobi] = useState('0')
  const [join, setJoin] = useState(true)
  const [error, setError] = useState('')

  const submit = () => {
    if (!tipPrevoza.trim()) {
      setError('Unesite tip prevoza.')
      return
    }
    if (!nazivGrupe.trim()) {
      setError('Unesite naziv grupe.')
      return
    }
    const kap = parseInt(kapacitet, 10)
    if (!Number.isFinite(kap) || kap < 1) {
      setError('Kapacitet mora biti najmanje 1.')
      return
    }
    const cena = parseFloat(cenaPoOsobi.replace(',', '.'))
    setError('')
    void onSubmit({
      tipPrevoza: tipPrevoza.trim(),
      nazivGrupe: nazivGrupe.trim(),
      kapacitet: kap,
      cenaPoOsobi: Number.isFinite(cena) ? cena : 0,
      join,
    })
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text variant="heading">Dodaj prevoz</Text>
          <Input label="Tip prevoza" value={tipPrevoza} onChangeText={setTipPrevoza} placeholder="Automobil, kombi…" />
          <Input label="Naziv grupe" value={nazivGrupe} onChangeText={setNazivGrupe} placeholder="Moja ekipa" />
          <Input label="Kapacitet" keyboardType="number-pad" value={kapacitet} onChangeText={setKapacitet} />
          <Input
            label={`Cena po osobi (${currency})`}
            keyboardType="decimal-pad"
            value={cenaPoOsobi}
            onChangeText={setCenaPoOsobi}
          />
          <View style={styles.switchRow}>
            <Text>Pridruži me ovom prevozu</Text>
            <Switch value={join} onValueChange={setJoin} trackColor={{ true: colors.brand }} />
          </View>
          {error ? (
            <Text variant="small" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button title="Otkaži" variant="ghost" onPress={onClose} />
            <Button title="Sačuvaj" loading={loading} onPress={submit} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
})
