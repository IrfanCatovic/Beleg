import { Link } from 'react-router-dom'
import type { TFunction } from 'i18next'
import { formatDate } from '../../../utils/dateUtils'
import {
  labelGuideBookingEquipment,
  labelGuideBookingExperience,
  labelGuideBookingTimeOfDay,
} from '../../ferrate/guideBookingDisplayLabels'
import type { FerrataGuideBookingPublic } from '../../../services/ferrataGuideBookings'
import type { PeakGuideBookingPublic } from '../../../services/peakGuideBookings'

interface GuideBookingNotificationCardProps {
  booking: FerrataGuideBookingPublic | PeakGuideBookingPublic
  kind: 'ferrata' | 'peak'
  busy: boolean
  tFerrate: TFunction
  onAccept: () => void
  onReject: () => void
}

export function GuideBookingNotificationCard({
  booking,
  kind,
  busy,
  tFerrate,
  onAccept,
  onReject,
}: GuideBookingNotificationCardProps) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm overflow-hidden mb-6">
      <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400" />
      <div className="p-5 sm:p-6 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Zahtev za vođenje</p>
        <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">
          {kind === 'peak'
            ? (booking as PeakGuideBookingPublic).peak.naziv
            : (booking as FerrataGuideBookingPublic).ferrata.naziv}
        </h2>
        <p className="text-sm text-gray-600">
          {booking.requester.fullName?.trim() || booking.requester.username}
          {booking.requester.klubNaziv ? ` · ${booking.requester.klubNaziv}` : ''}
        </p>
        <dl className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400">Datum</dt>
            <dd>
              {formatDate(booking.desiredDate)}
              {booking.dateFlexible ? ' (fleksibilan)' : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400">Vreme</dt>
            <dd>{labelGuideBookingTimeOfDay(tFerrate, booking.timeOfDay, booking.exactTime)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400">Broj osoba</dt>
            <dd>{booking.numberOfPeople}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400">Iskustvo grupe</dt>
            <dd>{labelGuideBookingExperience(tFerrate, booking.groupExperience)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400">Oprema</dt>
            <dd>{labelGuideBookingEquipment(tFerrate, booking.equipmentStatus)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400">Telefon</dt>
            <dd>
              <a href={`tel:${booking.contactPhone}`} className="font-semibold text-emerald-700 hover:underline">
                {booking.contactPhone}
              </a>
            </dd>
          </div>
        </dl>
        {booking.additionalMessage?.trim() && (
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-sm text-gray-700 whitespace-pre-line">
            {booking.additionalMessage.trim()}
          </div>
        )}
        {kind === 'ferrata' && (booking as FerrataGuideBookingPublic).ferrata.slug && (
          <Link
            to={`/ferrate/${(booking as FerrataGuideBookingPublic).ferrata.slug}`}
            className="inline-flex text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Otvori feratu →
          </Link>
        )}
        {kind === 'peak' && (
          <p className="text-sm text-gray-500">
            {(booking as PeakGuideBookingPublic).peak.planina?.trim() || 'Planinski uspon'}
            {(booking as PeakGuideBookingPublic).peak.visinaM
              ? ` · ${(booking as PeakGuideBookingPublic).peak.visinaM} m`
              : ''}
          </p>
        )}
        {booking.guideResponse && (
          <div
            className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${
              booking.guideResponse.status === 'pending'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : booking.guideResponse.status === 'accepted'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : booking.guideResponse.status === 'closed'
                    ? 'border-gray-200 bg-gray-50 text-gray-700'
                    : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {booking.guideResponse.status === 'pending'
              ? 'Na čekanju'
              : booking.guideResponse.status === 'accepted'
                ? 'Akcija kreirana'
                : booking.guideResponse.status === 'closed'
                  ? 'Rešio drugi vodič'
                  : 'Odbijeno'}
          </div>
        )}
        {booking.guideResponse?.status === 'closed' && booking.requestFulfilled && (
          <p className="text-sm text-gray-600">
            {booking.fulfilledByGuideName
              ? `${booking.fulfilledByGuideName} je već kreirao akciju za ovaj zahtev.`
              : 'Drugi vodič je već kreirao akciju za ovaj zahtev.'}
            {booking.fulfilledActionId ? (
              <>
                {' '}
                <Link
                  to={`/akcije/${booking.fulfilledActionId}`}
                  className="font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Pogledaj akciju
                </Link>
              </>
            ) : null}
          </p>
        )}
        {booking.guideResponse?.canRespond && (
          <div className="space-y-2 pt-2">
            <p className="text-xs text-gray-500">
              Prihvatanje otvara formu za akciju sa podacima iz zahteva. Možete izmeniti datum i vreme pre
              kreiranja. Zahtev ostaje otvoren za ostale vodiče dok ne sačuvate akciju.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onReject}
                disabled={busy}
                className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? '...' : 'Odbij'}
              </button>
              <button
                type="button"
                onClick={onAccept}
                disabled={busy}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? '...' : 'Prihvati'}
              </button>
            </div>
          </div>
        )}
        {booking.guideResponse?.status === 'accepted' && booking.guideResponse.actionId && (
          <Link
            to={`/akcije/${booking.guideResponse.actionId}`}
            className="inline-flex text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Otvori akciju
          </Link>
        )}
      </div>
    </div>
  )
}
