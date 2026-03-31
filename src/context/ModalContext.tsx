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
import { useTranslation } from 'react-i18next'

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
  confirmLabel: '',
  cancelLabel: '',
  okLabel: '',
  variant: 'default',
  resolveRef: { current: null },
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

export function ModalProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('uiExtras')
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
          confirmLabel: t('modal.yes'),
          cancelLabel: t('modal.no'),
          okLabel: t('modal.ok'),
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
          confirmLabel: t('modal.yes'),
          cancelLabel: t('modal.no'),
          okLabel: options.okLabel ?? t('modal.ok'),
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
          confirmLabel: options?.confirmLabel ?? t('modal.yes'),
          cancelLabel: options?.cancelLabel ?? t('modal.no'),
          okLabel: t('modal.ok'),
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

  const isDanger = state.variant === 'danger'
  const isConfirm = state.type === 'confirm'

  return (
    <ModalContext.Provider value={value}>
      {children}
      {state.open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-3 sm:px-4 animate-[fadeIn_150ms_ease-out]"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-desc"
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-[scaleIn_200ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6">
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                  isDanger ? 'bg-rose-50' : isConfirm ? 'bg-amber-50' : 'bg-emerald-50'
                }`}>
                  {isDanger ? (
                    <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  ) : isConfirm ? (
                    <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="text-center mb-5">
                {state.title && (
                  <h2 id="modal-title" className="text-base sm:text-lg font-bold text-gray-900 tracking-tight mb-1.5">
                    {state.title}
                  </h2>
                )}
                <p id="modal-desc" className="text-sm text-gray-500 leading-relaxed whitespace-pre-wrap">
                  {state.message}
                </p>
              </div>

              {/* Buttons */}
              {state.type === 'alert' ? (
                <button
                  type="button"
                  onClick={handleAlertOk}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/50 transition-all"
                >
                  {state.okLabel}
                </button>
              ) : (
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={close}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all"
                  >
                    {state.cancelLabel}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all ${
                      isDanger
                        ? 'text-white bg-gradient-to-r from-rose-400 via-rose-500 to-rose-400 hover:from-rose-300 hover:via-rose-400 hover:to-rose-300 shadow-rose-200/50'
                        : 'text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-emerald-200/50'
                    }`}
                  >
                    {state.confirmLabel}
                  </button>
                </div>
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
    throw new Error('useModal must be used inside ModalProvider')
  }
  return ctx
}
