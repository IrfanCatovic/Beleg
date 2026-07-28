import { useCallback, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import * as MediaLibrary from 'expo-media-library'
import type { AkcijaDetail } from '@beleg/shared'
import { Button, Text } from '../../../components/ui'
import { useModal } from '../../../context/ModalContext'
import { colors, radius, spacing } from '../../../theme'
import { SegmentedToggle } from '../../../components/ui/SegmentedToggle'
import {
  buildSummitShareData,
  type SummitAspect,
  type SummitLayout,
} from '../utils/summitShareData'
import {
  buildSummitCaptureOptions,
  createSummitBusyGate,
  shareSummitPngUri,
} from '../utils/summitShareActions'
import { SummitMountainCaptureView } from './SummitMountainCaptureView'
import { SummitFerrataCaptureView } from './SummitFerrataCaptureView'

interface Props {
  visible: boolean
  akcija: AkcijaDetail
  /** Auto-open from claimReward skips link step and starts at format/badge. */
  initialStep?: 'format' | 'badge'
  onClose: () => void
}

type MountainStep = 'format' | 'layout'

export function SummitShareModal({ visible, akcija, initialStep = 'format', onClose }: Props) {
  const { showAlert } = useModal()
  const captureViewRef = useRef<View>(null)
  const busyGateRef = useRef(createSummitBusyGate())
  const mountedRef = useRef(true)
  const [busy, setBusy] = useState(false)
  const [aspect, setAspect] = useState<SummitAspect | null>(
    initialStep === 'format' ? null : '9:16',
  )
  const [layout, setLayout] = useState<SummitLayout>('balanced')
  const [mountainStep, setMountainStep] = useState<MountainStep>(
    initialStep === 'badge' ? 'layout' : 'format',
  )

  const data = buildSummitShareData(akcija)
  const isFerrata = data.kind === 'ferrata'

  const safeSetBusy = useCallback((v: boolean) => {
    if (mountedRef.current) setBusy(v)
    if (!v) busyGateRef.current.release()
  }, [])

  const capturePng = useCallback(async (): Promise<string | null> => {
    if (!captureViewRef.current) return null
    const opts = buildSummitCaptureOptions(data.kind, aspect)
    return captureRef(captureViewRef, opts)
  }, [aspect, data.kind])

  const handleShare = useCallback(async () => {
    if (!busyGateRef.current.tryAcquire()) return
    if (!isFerrata && (!aspect || mountainStep !== 'layout')) {
      busyGateRef.current.release()
      return
    }
    safeSetBusy(true)
    try {
      const uri = await capturePng()
      if (!uri || !mountedRef.current) return
      const result = await shareSummitPngUri(uri, Sharing)
      if (!mountedRef.current) return
      if (result === 'unavailable') {
        await showAlert('Dijeljenje nije dostupno na ovom uređaju.', 'Greška')
      } else if (result === 'error') {
        await showAlert('Dijeljenje nije uspelo. Pokušaj ponovo.', 'Greška')
      }
    } catch {
      if (mountedRef.current) {
        await showAlert('Dijeljenje nije uspelo. Pokušaj ponovo.', 'Greška')
      }
    } finally {
      safeSetBusy(false)
    }
  }, [aspect, capturePng, isFerrata, mountainStep, safeSetBusy, showAlert])

  const handleSave = useCallback(async () => {
    if (!busyGateRef.current.tryAcquire()) return
    if (!isFerrata && (!aspect || mountainStep !== 'layout')) {
      busyGateRef.current.release()
      return
    }
    safeSetBusy(true)
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== 'granted') {
        if (mountedRef.current) {
          await showAlert('Dozvola za galeriju nije odobrena.', 'Greška')
        }
        return
      }
      const uri = await capturePng()
      if (!uri || !mountedRef.current) return
      await MediaLibrary.saveToLibraryAsync(uri)
      if (mountedRef.current) {
        await showAlert('Slika je sačuvana u galeriju.', 'Gotovo')
      }
    } catch {
      if (mountedRef.current) {
        await showAlert('Čuvanje nije uspelo. Pokušaj ponovo.', 'Greška')
      }
    } finally {
      safeSetBusy(false)
    }
  }, [aspect, capturePng, isFerrata, mountainStep, safeSetBusy, showAlert])

  const handleClose = () => {
    if (busyGateRef.current.isBusy) return
    onClose()
  }

  const showMountainFormat = !isFerrata && mountainStep === 'format'
  const showMountainLayout = !isFerrata && mountainStep === 'layout' && aspect != null
  const showFerrata = isFerrata

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text variant="label" style={styles.title}>
              Podeli sliku uspeha
            </Text>
            <Pressable onPress={handleClose} hitSlop={12} accessibilityLabel="Zatvori">
              <Text variant="label" color={colors.textMuted}>
                ✕
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} bounces={false}>
            {showMountainFormat ? (
              <>
                <Text variant="small" color={colors.textMuted}>
                  Izaberi format
                </Text>
                <View style={styles.formatRow}>
                  <View style={styles.formatBtn}>
                    <Button
                      title="9:16"
                      variant="secondary"
                      fullWidth
                      onPress={() => {
                        setAspect('9:16')
                        setMountainStep('layout')
                      }}
                    />
                  </View>
                  <View style={styles.formatBtn}>
                    <Button
                      title="16:9"
                      variant="secondary"
                      fullWidth
                      onPress={() => {
                        setAspect('16:9')
                        setMountainStep('layout')
                      }}
                    />
                  </View>
                </View>
              </>
            ) : null}

            {showMountainLayout && aspect ? (
              <>
                <Pressable
                  onPress={() => {
                    setMountainStep('format')
                    setAspect(null)
                  }}
                >
                  <Text color={colors.brand} variant="small">
                    Nazad
                  </Text>
                </Pressable>
                <Text variant="small" color={colors.textMuted}>
                  Izaberi raspored
                </Text>
                <SegmentedToggle
                  value={layout}
                  options={[
                    { value: 'balanced', label: 'Klasično (centrirano)' },
                    { value: 'stacked', label: 'Kompaktno' },
                  ]}
                  onChange={setLayout}
                />
                <View style={styles.previewWrap}>
                  <View ref={captureViewRef} collapsable={false} style={styles.captureBg}>
                    <SummitMountainCaptureView data={data} aspect={aspect} layout={layout} />
                  </View>
                </View>
                <View style={styles.actions}>
                  <Button title="Podeli" onPress={() => void handleShare()} loading={busy} fullWidth />
                  <Button
                    title="Sačuvaj u galeriju"
                    variant="secondary"
                    onPress={() => void handleSave()}
                    loading={busy}
                    fullWidth
                  />
                </View>
              </>
            ) : null}

            {showFerrata && data.kind === 'ferrata' ? (
              <>
                <Text variant="small" color={colors.textMuted}>
                  Via ferrata bedž
                </Text>
                <View style={styles.previewWrap}>
                  <View ref={captureViewRef} collapsable={false} style={styles.captureBg}>
                    <SummitFerrataCaptureView data={data} />
                  </View>
                </View>
                <View style={styles.actions}>
                  <Button title="Podeli" onPress={() => void handleShare()} loading={busy} fullWidth />
                  <Button
                    title="Sačuvaj u galeriju"
                    variant="secondary"
                    onPress={() => void handleSave()}
                    loading={busy}
                    fullWidth
                  />
                </View>
              </>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { flex: 1 },
  body: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  formatRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formatBtn: {
    flex: 1,
  },
  previewWrap: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  captureBg: {
    backgroundColor: '#111827',
    borderRadius: radius.md,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
})
