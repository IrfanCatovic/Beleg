import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime } from '../../utils/dateUtils'

interface SelectedRentItem {
  rentId: number
  kolicina: number
}

interface MemberDetailsModalProps {
  open: boolean
  onClose: () => void
  currency: string
  member: {
    id: number
    korisnik: string
    fullName?: string
    avatarUrl?: string
    prijavljenAt: string
    status: string
    selectedSmestajIds?: number[]
    selectedPrevozIds?: number[]
    selectedRentItems?: SelectedRentItem[]
    saldo?: number
    isClanKluba?: boolean
    platio?: boolean
  } | null
  smestaj: Array<{ id: number; naziv: string; cenaPoOsobiUkupno: number }>
  prevoz: Array<{ id: number; nazivGrupe: string; tipPrevoza: string; cenaPoOsobi: number }>
  opremaRent: Array<{ id: number; nazivOpreme: string; cenaPoSetu: number }>
  baseCenaClan: number
  baseCenaOstali: number
  javna: boolean
  statusLabel: string
  showPaymentControls?: boolean
  onTogglePayment?: (nextPlatio: boolean) => Promise<void>
}

export default function MemberDetailsModal({
  open,
  onClose,
  currency,
  member,
  smestaj,
  prevoz,
  opremaRent,
  baseCenaClan,
  baseCenaOstali,
  javna,
  statusLabel,
  showPaymentControls = false,
  onTogglePayment,
}: MemberDetailsModalProps) {
  const [togglingPayment, setTogglingPayment] = useState(false)
  if (!open || !member) return null

  const displayName = member.fullName?.trim() ? member.fullName : member.korisnik
  const initial = displayName.charAt(0).toUpperCase() || '?'
  const baseCena = member.isClanKluba ? baseCenaClan : javna ? baseCenaOstali : baseCenaClan
  const pickedSmestaj = smestaj.filter((s) => (member.selectedSmestajIds || []).includes(s.id))
  const pickedPrevoz = prevoz.filter((p) => (member.selectedPrevozIds || []).includes(p.id))
  const pickedRent = (member.selectedRentItems || [])
    .map((r) => {
      const match = opremaRent.find((o) => o.id === r.rentId)
      if (!match) return null
      return { ...match, kolicina: r.kolicina }
    })
    .filter(Boolean) as Array<{ id: number; nazivOpreme: string; cenaPoSetu: number; kolicina: number }>
  const total =
    typeof member.saldo === 'number'
      ? member.saldo
      : baseCena +
        pickedSmestaj.reduce((s, x) => s + x.cenaPoOsobiUkupno, 0) +
        pickedPrevoz.reduce((s, x) => s + x.cenaPoOsobi, 0) +
        pickedRent.reduce((s, x) => s + x.cenaPoSetu * x.kolicina, 0)

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/90 to-teal-50/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white shadow-sm shrink-0">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt={displayName} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
              <Link
                to={`/korisnik/${member.korisnik}`}
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                @{member.korisnik}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
            </div>
          </div>
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

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-200">
              Prijava: {formatDateTime(member.prijavljenAt)}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
              {statusLabel}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                member.isClanKluba
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-violet-50 text-violet-700 border-violet-200'
              }`}
            >
              {member.isClanKluba ? 'Član kluba' : 'Gost'}
            </span>
            {showPaymentControls && (
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                  member.platio
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {member.platio ? 'Platio' : 'Nije platio'}
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between py-2 px-3.5 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-xs font-semibold text-gray-600">Osnovna cena akcije</span>
              <span className="text-sm font-bold text-gray-900">
                {baseCena.toFixed(2)} {currency}
              </span>
            </div>

            {pickedSmestaj.length > 0 && (
              <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1.5">Smeštaj</p>
                <div className="space-y-1">
                  {pickedSmestaj.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">{s.naziv}</span>
                      <span className="font-bold text-gray-900">
                        {s.cenaPoOsobiUkupno.toFixed(2)} {currency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pickedPrevoz.length > 0 && (
              <div className="rounded-xl bg-sky-50/60 border border-sky-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700 mb-1.5">Prevoz</p>
                <div className="space-y-1">
                  {pickedPrevoz.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">
                        {p.nazivGrupe} <span className="text-gray-400">· {p.tipPrevoza}</span>
                      </span>
                      <span className="font-bold text-gray-900">
                        {p.cenaPoOsobi.toFixed(2)} {currency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pickedRent.length > 0 && (
              <div className="rounded-xl bg-violet-50/60 border border-violet-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700 mb-1.5">Iznajmljena oprema</p>
                <div className="space-y-1">
                  {pickedRent.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">
                        {r.nazivOpreme} × {r.kolicina}
                      </span>
                      <span className="font-bold text-gray-900">
                        {(r.cenaPoSetu * r.kolicina).toFixed(2)} {currency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pickedSmestaj.length === 0 && pickedPrevoz.length === 0 && pickedRent.length === 0 && (
              <p className="text-[11px] text-gray-500 italic">Nema dodatnih izbora pored osnovne cene.</p>
            )}
          </div>

          <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Ukupno zaduženje</p>
            <p className="mt-1 text-3xl font-extrabold text-emerald-800">
              {total.toFixed(2)} <span className="text-emerald-600 text-lg font-bold">{currency}</span>
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <Link
            to={`/korisnik/${member.korisnik}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 transition-colors"
          >
            Otvori profil
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <div className="flex items-center gap-2">
            {showPaymentControls && onTogglePayment && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    setTogglingPayment(true)
                    await onTogglePayment(!member.platio)
                  } finally {
                    setTogglingPayment(false)
                  }
                }}
                disabled={togglingPayment}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-60 ${
                  member.platio
                    ? 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100'
                    : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {togglingPayment ? 'Čuvam...' : member.platio ? 'Označi nije platio' : 'Označi platio'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Zatvori
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
