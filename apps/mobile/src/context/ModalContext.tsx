import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, fontWeight, radius, spacing } from '../theme'

type Variant = 'default' | 'danger'

interface DialogState {
  title: string
  message?: string
  variant: Variant
  confirmLabel: string
  cancelLabel?: string
  isConfirm: boolean
  resolve: (value: boolean) => void
}

interface ModalContextType {
  showAlert: (title: string, message?: string) => Promise<boolean>
  showConfirm: (
    title: string,
    message?: string,
    options?: { variant?: Variant; confirmLabel?: string; cancelLabel?: string },
  ) => Promise<boolean>
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

export function ModalProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)

  const close = useCallback(
    (result: boolean) => {
      dialog?.resolve(result)
      setDialog(null)
    },
    [dialog],
  )

  const showAlert = useCallback((title: string, message?: string) => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        title,
        message,
        variant: 'default',
        confirmLabel: 'OK',
        isConfirm: false,
        resolve,
      })
    })
  }, [])

  const showConfirm = useCallback(
    (
      title: string,
      message?: string,
      options?: { variant?: Variant; confirmLabel?: string; cancelLabel?: string },
    ) => {
      return new Promise<boolean>((resolve) => {
        setDialog({
          title,
          message,
          variant: options?.variant ?? 'default',
          confirmLabel: options?.confirmLabel ?? 'Potvrdi',
          cancelLabel: options?.cancelLabel ?? 'Otkaži',
          isConfirm: true,
          resolve,
        })
      })
    },
    [],
  )

  const value = useMemo(() => ({ showAlert, showConfirm }), [showAlert, showConfirm])

  return (
    <ModalContext.Provider value={value}>
      {children}
      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => close(false)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            {dialog ? (
              <>
                <Text style={styles.title}>{dialog.title}</Text>
                {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
                <View style={styles.actions}>
                  {dialog.isConfirm ? (
                    <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => close(false)}>
                      <Text style={styles.btnGhostText}>{dialog.cancelLabel}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={[
                      styles.btn,
                      dialog.variant === 'danger' ? styles.btnDanger : styles.btnPrimary,
                    ]}
                    onPress={() => close(true)}
                  >
                    <Text style={styles.btnPrimaryText}>{dialog.confirmLabel}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </ModalContext.Provider>
  )
}

export function useModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal must be used within ModalProvider')
  return ctx
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  message: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  btn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: colors.brand },
  btnDanger: { backgroundColor: colors.danger },
  btnPrimaryText: { color: colors.white, fontWeight: fontWeight.semibold },
  btnGhost: { backgroundColor: colors.surfaceAlt },
  btnGhostText: { color: colors.text, fontWeight: fontWeight.medium },
})
