import { useState } from 'react'
import CalendarDropdown from './CalendarDropdown'
import { dateToYMD } from '../utils/dateUtils'
import { getRoleLabel } from '../utils/roleUtils'
import { useTranslation } from 'react-i18next'

export type Role = 'admin' | 'clan' | 'vodic' | 'blagajnik' | 'sekretar' | 'menadzer-opreme'

interface NewTaskModalProps {
  open: boolean
  onClose: () => void
  onCreate: (data: {
    naziv: string
    opis: string
    deadline: string | null
    hitno: boolean
    allowedRoles: Role[]
    allowAll: boolean
  }) => Promise<void>
}

export default function NewTaskModal({ open, onClose, onCreate }: NewTaskModalProps) {
  const { t } = useTranslation('uiExtras')
  const [naziv, setNaziv] = useState('')
  const [opis, setOpis] = useState('')
  const [deadline, setDeadline] = useState<string | null>(null)
  const [hitno, setHitno] = useState(false)
  const [allowedRoles, setAllowedRoles] = useState<Role[]>([])
  const [allowAll, setAllowAll] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const handleToggleRole = (role: Role) => {
    setAllowedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  const resetForm = () => {
    setNaziv('')
    setOpis('')
    setDeadline(null)
    setHitno(false)
    setAllowedRoles([])
    setAllowAll(false)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!naziv.trim()) {
      setError(t('taskModal.errors.enterName'))
      return
    }
    if (!allowAll && allowedRoles.length === 0) {
      setError(t('taskModal.errors.pickRoleOrAll'))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onCreate({
        naziv: naziv.trim(),
        opis: opis.trim(),
        deadline,
        hitno,
        allowedRoles,
        allowAll,
      })
      resetForm()
      onClose()
    } catch (err: any) {
      setError(err?.message || t('taskModal.errors.create'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-3 sm:px-4 animate-[fadeIn_150ms_ease-out]"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="w-full max-w-lg sm:max-w-xl lg:max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-[scaleIn_200ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center mt-0.5">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">{t('taskModal.newTitle')}</h2>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">
                {t('taskModal.newSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label={t('common.close')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 sm:py-6">
          {error && (
            <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white flex-shrink-0">!</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-700">
                  {t('taskModal.fields.taskName')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={naziv}
                  onChange={(e) => setNaziv(e.target.value)}
                  placeholder={t('taskModal.placeholders.taskName')}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 focus:bg-white outline-none transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-700">
                  {t('taskModal.fields.deadline')}
                </label>
                <CalendarDropdown
                  value={deadline ?? ''}
                  onChange={(value) => setDeadline(value || null)}
                  placeholder={t('taskModal.placeholders.pickDate')}
                  minDate={dateToYMD(new Date())}
                  aria-label={t('taskModal.aria.deadline')}
                  fullWidth
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">{t('taskModal.fields.description')}</label>
              <textarea
                value={opis}
                onChange={(e) => setOpis(e.target.value)}
                rows={3}
                placeholder={t('taskModal.placeholders.description')}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 focus:bg-white outline-none transition resize-y min-h-[72px]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Roles */}
              <div className="space-y-2.5 md:col-span-2">
                <p className="text-xs font-medium text-gray-700">{t('taskModal.fields.whoCanDo')}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] sm:text-xs">
                  {(['admin', 'sekretar', 'vodic', 'blagajnik', 'menadzer-opreme'] as Role[]).map(
                    (role) => (
                      <label
                        key={role}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-all ${
                          allowedRoles.includes(role)
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100/50'
                            : 'border-gray-100 bg-gray-50/50 hover:bg-gray-100 hover:border-gray-200 text-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={allowedRoles.includes(role)}
                          onChange={() => handleToggleRole(role)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-emerald-500 focus:ring-emerald-400"
                        />
                        <span className="truncate font-medium">{getRoleLabel(role)}</span>
                      </label>
                    )
                  )}
                  <label
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-all md:col-span-3 ${
                      allowAll
                        ? 'border-amber-300 bg-amber-50 text-amber-700 shadow-sm shadow-amber-100/50'
                        : 'border-gray-100 bg-gray-50/50 hover:bg-gray-100 hover:border-gray-200 text-gray-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={allowAll}
                      onChange={(e) => setAllowAll(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                    />
                    <span className="text-xs font-semibold">{t('taskModal.fields.allRoles')}</span>
                  </label>
                </div>
                <p className="text-[10px] sm:text-[11px] text-gray-400">
                  {t('taskModal.help.allRoles')}
                </p>
              </div>

              {/* Urgent toggle */}
              <div className="space-y-2">
                <div className={`rounded-xl border px-3.5 py-3 transition-all ${hitno ? 'border-rose-300 bg-rose-50' : 'border-gray-100 bg-gray-50/50'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-xs font-semibold ${hitno ? 'text-rose-700' : 'text-gray-700'}`}>{t('taskModal.fields.urgent')}</p>
                      <p className={`text-[10px] mt-0.5 ${hitno ? 'text-rose-500' : 'text-gray-400'}`}>
                        {t('taskModal.help.urgent')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHitno((prev) => !prev)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        hitno ? 'bg-rose-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                          hitno ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-gray-100">
              <p className="text-[10px] sm:text-[11px] text-gray-400">
                {t('taskModal.help.multiAssignees')}
              </p>
              <div className="flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm shadow-emerald-200/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? t('taskModal.creating') : t('taskModal.saveTask')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
