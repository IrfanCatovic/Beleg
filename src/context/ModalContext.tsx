/**
 * Univerzalni modal za obaveštenja i pitanja (umesto window.alert / window.confirm).
 *
 * Korišćenje u komponenti:
 * 1. import { useModal } from '../context/ModalContext'
 * 2. const { showAlert, showConfirm } = useModal()
 *
 * Obaveštenje (samo poruka + OK):
 *   await showAlert('Uspešno ste se prijavili!')
 *   showAlert('Greška.', 'Naslov')  // opciono: drugi argument = naslov
 *
 * Pitanje Da/Ne (npr. pre brisanja ili prijave):
 *   const confirmed = await showConfirm('Da li želite da obrišete ovu akciju?')
 *   if (!confirmed) return
 *   await api.delete(...)
 *   await showAlert('Obrisano.')
 *
 * Za opasne akcije (crveno dugme):
 *   const ok = await showConfirm('Trajno obrisati?', { variant: 'danger', confirmLabel: 'Obriši' })
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

export type ModalType = 'alert' | 'confirm'

export interface ConfirmOptions {
  message: string
  title?: string

  confirmLabel?: string

  cancelLabel?: string

  variant?: 'default' | 'danger'
}

export interface AlertOptions {
  message: string
  title?: string
  okLabel?: string
}

interface ModalState {
  open: boolean
  type: ModalType
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  okLabel: string
  variant: 'default' | 'danger'
  resolveRef: { current: ((value?: boolean) => void) | null }
}

interface ModalContextType {
  showAlert: (message: string, title?: string) => Promise<void>
  showAlertOptions: (options: AlertOptions) => Promise<void>
  showConfirm: (message: string, options?: Partial<ConfirmOptions>) => Promise<boolean>
}

const defaultState: ModalState = {
  open: false,
  type: 'alert',
  title: '',
  message: '',
  confirmLabel: 'Da',
  cancelLabel: 'Ne',
  okLabel: 'U redu',
  variant: 'default',
  resolveRef: { current: null },
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

export function ModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ModalState>(defaultState)

  const close = useCallback(() => {
    if (state.type === 'confirm' && state.resolveRef.current) {
      state.resolveRef.current(false)
    }
    setState((prev) => ({ ...prev, open: false }))
  }, [state.type, state.resolveRef])

  const showAlert = useCallback(
    (message: string, title?: string) =>
      new Promise<void>((resolve) => {
        const resolveRef: ModalState['resolveRef'] = {
          current: () => resolve(),
        }
        setState({
          open: true,
          type: 'alert',
          title: title ?? '',
          message,
          confirmLabel: 'Da',
          cancelLabel: 'Ne',
          okLabel: 'U redu',
          variant: 'default',
          resolveRef,
        })
      }),
    []
  )

  const showAlertOptions = useCallback(
    (options: AlertOptions) =>
      new Promise<void>((resolve) => {
        const resolveRef: ModalState['resolveRef'] = { current: () => resolve() }
        setState({
          open: true,
          type: 'alert',
          title: options.title ?? '',
          message: options.message,
          confirmLabel: 'Da',
          cancelLabel: 'Ne',
          okLabel: options.okLabel ?? 'U redu',
          variant: 'default',
          resolveRef,
        })
      }),
    []
  )

  const showConfirm = useCallback(
    (message: string, options?: Partial<ConfirmOptions>) =>
      new Promise<boolean>((resolve) => {
        const resolveRef: ModalState['resolveRef'] = {
          current: (value?: boolean) => resolve(value === true),
        }
        setState({
          open: true,
          type: 'confirm',
          title: options?.title ?? '',
          message,
          confirmLabel: options?.confirmLabel ?? 'Da',
          cancelLabel: options?.cancelLabel ?? 'Ne',
          okLabel: 'U redu',
          variant: options?.variant ?? 'default',
          resolveRef,
        })
      }),
    []
  )

  const handleConfirm = useCallback(() => {
    if (state.resolveRef.current) state.resolveRef.current(true)
    setState((prev) => ({ ...prev, open: false }))
  }, [state.resolveRef])

  const handleAlertOk = useCallback(() => {
    if (state.resolveRef.current) state.resolveRef.current(false)
    setState((prev) => ({ ...prev, open: false }))
  }, [state.resolveRef])

  const value: ModalContextType = {
    showAlert,
    showAlertOptions,
    showConfirm,
  }

  return (
    <ModalContext.Provider value={value}>
      {children}
      {state.open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-3 sm:px-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-desc"
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {(state.title || state.message) && (
              <div className="mb-4">
                {state.title && (
                  <h2 id="modal-title" className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
                    {state.title}
                  </h2>
                )}
                <p id="modal-desc" className="text-sm text-gray-600 whitespace-pre-wrap">
                  {state.message}
                </p>
              </div>
            )}
            <div className="flex flex-row gap-2 justify-end">
              {state.type === 'alert' ? (
                <button
                  type="button"
                  onClick={handleAlertOk}
                  className="px-4 py-2 rounded-lg bg-[#41ac53] text-white text-sm font-medium shadow-sm hover:bg-[#358c43]"
                >
                  {state.okLabel}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    {state.cancelLabel}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className={
                      state.variant === 'danger'
                        ? 'px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium shadow-sm hover:bg-red-700'
                        : 'px-4 py-2 rounded-lg bg-[#41ac53] text-white text-sm font-medium shadow-sm hover:bg-[#358c43]'
                    }
                  >
                    {state.confirmLabel}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  )
}

export function useModal() {
  const ctx = useContext(ModalContext)
  if (ctx === undefined) {
    throw new Error('useModal mora da se koristi unutar ModalProvider')
  }
  return ctx
}
