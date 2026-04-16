import { useEffect, useState } from 'react'

interface AddTransportModalProps {
  open: boolean
  currency: string
  onClose: () => void
  onSubmit: (data: { tipPrevoza: string; nazivGrupe: string; kapacitet: number; cenaPoOsobi: number; join: boolean }) => Promise<void>
}

const TYPES = [
  { value: 'auto', label: 'Auto' },
  { value: 'kombi', label: 'Kombi' },
  { value: 'minibus', label: 'Minibus' },
  { value: 'autobus', label: 'Autobus' },
  { value: 'voz', label: 'Voz' },
]

export default function AddTransportModal({ open, currency, onClose, onSubmit }: AddTransportModalProps) {
  const [tip, setTip] = useState('auto')
  const [naziv, setNaziv] = useState('')
  const [kapacitet, setKapacitet] = useState('4')
  const [cena, setCena] = useState('0')
  const [join, setJoin] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setTip('auto')
    setNaziv('')
    setKapacitet('4')
    setCena('0')
    setJoin(true)
    setError('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const kap = Number(kapacitet)
    const cen = Number(cena)
    if (!naziv.trim()) {
      setError('Naziv je obavezan (npr. "Mirzino jato")')
      return
    }
    if (!Number.isFinite(kap) || kap < 1 || kap > 50) {
      setError('Kapacitet mora biti 1–50')
      return
    }
    if (!Number.isFinite(cen) || cen < 0) {
      setError('Cena mora biti pozitivan broj')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        tipPrevoza: tip,
        nazivGrupe: naziv.trim(),
        kapacitet: kap,
        cenaPoOsobi: cen,
        join,
      })
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Greška pri čuvanju prevoza')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-sky-50/90 to-indigo-50/50">
          <h2 className="text-sm font-bold text-gray-900 tracking-tight">Dodaj novi prevoz</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-white/80 hover:text-gray-800 transition-colors"
            aria-label="Zatvori"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Tip prevoza</label>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTip(opt.value)}
                  className={`px-2 py-2 rounded-lg text-[11px] font-bold transition-colors ${
                    tip === opt.value
                      ? 'bg-sky-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Naziv prevoza</label>
            <input
              type="text"
              value={naziv}
              onChange={(e) => setNaziv(e.target.value)}
              placeholder="npr. Mirzino jato"
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 transition-all"
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Kapacitet</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                value={kapacitet}
                onChange={(e) => setKapacitet(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Cena / osoba ({currency})</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={cena}
                onChange={(e) => setCena(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 transition-all"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={join}
              onChange={(e) => setJoin(e.target.checked)}
              className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-400"
            />
            <span className="text-xs font-semibold text-emerald-800">Odmah se prijavi na ovaj prevoz</span>
          </label>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Otkaži
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 shadow-sm disabled:opacity-60 transition-all"
            >
              {submitting ? 'Dodajem…' : 'Dodaj prevoz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
