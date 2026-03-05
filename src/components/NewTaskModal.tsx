import { useState } from 'react'
import CalendarDropdown from './CalendarDropdown'
import { dateToYMD } from '../utils/dateUtils'
import { getRoleLabel } from '../utils/roleUtils'

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
      setError('Unesite naziv zadatka.')
      return
    }
    if (!allowAll && allowedRoles.length === 0) {
      setError('Izaberite barem jednu ulogu ili opciju "Svi".')
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
      setError(err?.message || 'Greška pri kreiranju zadatka.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 sm:px-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="w-full max-w-lg sm:max-w-xl lg:max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              Novi zadatak
            </h2>
            <p className="text-[11px] sm:text-xs text-gray-500">
              Popuni detalje zadatka koji će članovi tima moći da preuzmu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Zatvori"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">
                Naziv zadatka <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={naziv}
                onChange={(e) => setNaziv(e.target.value)}
                placeholder="npr. Priprema opreme za vikend akciju"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#41ac53] focus:ring-1 focus:ring-[#41ac53]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">
                Rok za završetak
              </label>
              <CalendarDropdown
                value={deadline ?? ''}
                onChange={(value) => setDeadline(value || null)}
                placeholder="Izaberi datum"
                minDate={dateToYMD(new Date())}
                aria-label="Rok za završetak zadatka"
                fullWidth
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">
              Opis zadatka
            </label>
            <textarea
              value={opis}
              onChange={(e) => setOpis(e.target.value)}
              rows={3}
              placeholder="Ukratko opiši šta treba da se uradi, koji su koraci ili očekivanja..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#41ac53] focus:ring-1 focus:ring-[#41ac53] resize-y min-h-[72px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2 md:col-span-2">
              <p className="text-xs font-medium text-gray-700">
                Ko sve može da radi ovaj zadatak?
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px] sm:text-xs">
                {(['admin', 'sekretar', 'vodic', 'blagajnik', 'menadzer-opreme'] as Role[]).map(
                  (role) => (
                    <label
                      key={role}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-colors ${
                        allowedRoles.includes(role)
                          ? 'border-[#41ac53] bg-[#41ac53]/5 text-[#1f5f30]'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={allowedRoles.includes(role)}
                        onChange={() => handleToggleRole(role)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-[#41ac53] focus:ring-[#41ac53]"
                      />
                      <span className="truncate">{getRoleLabel(role)}</span>
                    </label>
                  )
                )}
                <label
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-colors ${
                    allowAll
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'
                  } md:col-span-3`}
                >
                  <input
                    type="checkbox"
                    checked={allowAll}
                    onChange={(e) => setAllowAll(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-red-500 focus:ring-red-400"
                  />
                  <span className="text-xs font-semibold">
                    Svi (uključuje i članove kluba)
                  </span>
                </label>
              </div>
              <p className="mt-1 text-[10px] sm:text-[11px] text-gray-500">
                Ako izabereš opciju <span className="font-semibold">Svi</span>, zadatak će biti
                vidljiv i dostupnan za preuzimanje i članovima kluba.
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-red-700">Hitno</p>
                  <p className="text-[10px] text-red-600">
                    Ide na vrh liste i označen je crveno.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHitno((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    hitno ? 'bg-red-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      hitno ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <p className="text-[10px] sm:text-[11px] text-gray-500">
              Jedan zadatak može istovremeno da preuzme više korisnika.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-1.5 rounded-lg border border-gray-300 text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
              >
                Otkaži
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-1.5 rounded-lg bg-[#41ac53] text-white text-xs sm:text-sm font-medium shadow-sm hover:bg-[#358c43] disabled:opacity-60"
              >
                {submitting ? 'Kreiranje...' : 'Sačuvaj zadatak'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

