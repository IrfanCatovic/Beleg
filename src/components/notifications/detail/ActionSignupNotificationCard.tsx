import { Link } from 'react-router-dom'
import type { ActionSignupRequest } from '../../../services/actions'

interface ActionSignupNotificationCardProps {
  request: ActionSignupRequest
  akcijaNaziv?: string
  akcijaId?: number | null
  busy: boolean
  onRespond: (decision: 'accept' | 'reject') => void
}

export function ActionSignupNotificationCard({
  request,
  akcijaNaziv,
  akcijaId,
  busy,
  onRespond,
}: ActionSignupNotificationCardProps) {
  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50/80 to-orange-50/50 shadow-md overflow-hidden mb-6">
      <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" />
      <div className="p-5 sm:p-6 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Novi zahtev za prijavu</p>
        <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">
          {akcijaNaziv?.trim() || request.action?.naziv || 'Akcija'}
        </h2>
        <p className="text-sm text-gray-700">
          <span className="font-bold">
            {request.requester.fullName?.trim() || request.requester.username}
          </span>{' '}
          želi da se prijavi na akciju.
        </p>
        {(request.selectedPrevozIds?.length || request.selectedRentItems?.length) ? (
          <div className="rounded-xl border border-amber-100 bg-white/70 px-4 py-3 text-sm text-gray-700">
            {request.selectedPrevozIds?.length ? <p>Prevoz izabran</p> : null}
            {request.selectedRentItems?.length ? (
              <p className="mt-1">
                Oprema: {request.selectedRentItems.map((r) => `×${r.kolicina}`).join(', ')}
              </p>
            ) : null}
          </div>
        ) : null}
        <div
          className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${
            request.status === 'pending'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : request.status === 'accepted'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {request.status === 'pending'
            ? 'Čeka odobrenje'
            : request.status === 'accepted'
              ? 'Prihvaćeno'
              : 'Odbijeno'}
        </div>
        {request.status === 'pending' && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => onRespond('reject')}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-60"
            >
              {busy ? '...' : 'Odbij'}
            </button>
            <button
              type="button"
              onClick={() => onRespond('accept')}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-60"
            >
              {busy ? '...' : 'Prihvati prijavu'}
            </button>
          </div>
        )}
        {akcijaId != null && (
          <Link
            to={`/akcije/${akcijaId}`}
            className="inline-flex text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Otvori akciju →
          </Link>
        )}
      </div>
    </div>
  )
}
