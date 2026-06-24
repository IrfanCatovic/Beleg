import { Link } from 'react-router-dom'
import { formatDate } from '../../../utils/dateUtils'
import type { ActionParticipationRequestPayload } from './notificationDetailTypes'

interface ParticipationRequestCardProps {
  request: ActionParticipationRequestPayload
  busy: boolean
  onRespond: (decision: 'accept' | 'reject') => void
}

export function ParticipationRequestCard({ request, busy, onRespond }: ParticipationRequestCardProps) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-white shadow-sm overflow-hidden mb-6">
      <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400" />
      <div className="p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Potvrda učešća</p>
        <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">{request.action.naziv}</h2>
        <p className="mt-2 text-sm text-gray-600">
          {request.requestedBy.fullName?.trim() || request.requestedBy.username}
          {request.requestedBy.klubNaziv ? ` · ${request.requestedBy.klubNaziv}` : ''}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Datum akcije: {formatDate(request.action.datum)}
          {request.action.klubNaziv ? ` · domaći klub: ${request.action.klubNaziv}` : ''}
        </p>
        <div
          className={`mt-4 inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${
            request.status === 'pending'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : request.status === 'accepted'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : request.status === 'rejected'
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-gray-200 bg-gray-100 text-gray-700'
          }`}
        >
          {request.status === 'pending'
            ? 'Čeka tvoj odgovor'
            : request.status === 'accepted'
              ? 'Prihvaćeno'
              : request.status === 'rejected'
                ? 'Odbijeno'
                : 'Otkazano'}
        </div>
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-gray-700">
          Prihvatanjem će akcija biti upisana na tvoj profil kao istorijska stavka bez finansijskog efekta.
        </div>
        {request.status === 'pending' && (
          <div className="mt-5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
            <button
              type="button"
              onClick={() => onRespond('reject')}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? '...' : 'Odbij'}
            </button>
            <button
              type="button"
              onClick={() => onRespond('accept')}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? '...' : 'Potvrdi'}
            </button>
          </div>
        )}
        {request.status === 'accepted' && (
          <div className="mt-4">
            <Link
              to={`/akcije/${request.action.id}`}
              className="inline-flex text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Otvori akciju
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
