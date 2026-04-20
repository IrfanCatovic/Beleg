import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { getRoleLabel, getRoleStyle, hasVisibleRole } from '../../../utils/roleUtils'
import { formatDate } from '../../../utils/dateUtils'
import Loader from '../../../components/Loader'
import {
  UserCircleIcon,
  IdentificationIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarDaysIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'

interface KorisnikInfo {
  id: number
  username: string
  fullName?: string
  avatar_url?: string
  email?: string
  telefon?: string
  role: string
  createdAt: string
  updatedAt: string
  ime_roditelja?: string
  pol?: string
  datum_rodjenja?: string | null
  drzavljanstvo?: string
  adresa?: string
  broj_licnog_dokumenta?: string
  broj_planinarske_legitimacije?: string
  broj_planinarske_markice?: string
  datum_uclanjenja?: string | null
  izrecene_disciplinske_kazne?: string
  izbor_u_organe_sportskog_udruzenja?: string
  napomene?: string
  ukupnoKm?: number
  ukupnoMetaraUspona?: number
  brojPopeoSe?: number
}

interface BlockedUser {
  id: number
  username: string
  fullName?: string
  avatarUrl?: string
  klubNaziv?: string
}

function InfoRow({ label, value, alwaysShow = false, icon: Icon }: { label: string; value: React.ReactNode; alwaysShow?: boolean; icon?: React.ComponentType<{ className?: string }> }) {
  const isEmpty = value === undefined || value === null || value === ''
  if (!alwaysShow && isEmpty) return null
  const displayValue = isEmpty ? '—' : value
  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0 last:pb-0 first:pt-0">
      {Icon && <Icon className="h-5 w-5 shrink-0 text-gray-400 mt-0.5" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <div className="mt-0.5 text-sm text-gray-900">{displayValue}</div>
      </div>
    </div>
  )
}

export default function UserInfo() {
  const { t, i18n } = useTranslation('userInfo')
  const { id } = useParams<{ id: string }>()
  const { user: currentUser } = useAuth()
  const [korisnik, setKorisnik] = useState<KorisnikInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'blocked'>('info')
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])

  useEffect(() => {
    if (!id || !currentUser) return
    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.get(`/api/korisnici/${id}/info`)
        const data = res.data as KorisnikInfo
        setKorisnik(data)
      } catch (err: any) {
        setError(err.response?.data?.error || t('loadError'))
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, currentUser])

  useEffect(() => {
    if (!currentUser || !korisnik) return
    const isOwnProfile = korisnik.username === currentUser.username
    if (!isOwnProfile) return
    api.get('/api/blocks/mine')
      .then((res) => setBlockedUsers((res.data.users || []) as BlockedUser[]))
      .catch(() => setBlockedUsers([]))
  }, [currentUser, korisnik])

  if (loading) return <Loader />
  if (error || !korisnik) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-rose-600 font-medium">{error || t('notFound')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] bg-gradient-to-b from-gray-50 to-white">
      {/* Hero */}
      <div className="border-b border-gray-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link to="/users" className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
                <ArrowLeftIcon className="h-5 w-5" />
                {t('backToList')}
              </Link>
            </div>
            <Link to={`/korisnik/${korisnik.username}`} className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline shrink-0">
              {t('viewPublicProfile')}
            </Link>
          </div>
          <div className="flex items-center gap-5 mt-6">
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-3xl shrink-0">
              {korisnik.avatar_url && !avatarLoadFailed ? (
                <img src={korisnik.avatar_url} alt="" className="h-full w-full object-cover" onError={() => setAvatarLoadFailed(true)} />
              ) : (
                <span>{(korisnik.fullName || korisnik.username || '?').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{korisnik.fullName || korisnik.username}</h1>
              <p className="text-gray-500 mt-0.5">@{korisnik.username}</p>
              {hasVisibleRole(korisnik.role) && (
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${getRoleStyle(korisnik.role)}`}>
                  {getRoleLabel(korisnik.role)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {currentUser && korisnik.username === currentUser.username && (
          <div className="mb-6 inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${activeTab === 'info' ? 'bg-emerald-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {t('tabs.info')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('blocked')}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${activeTab === 'blocked' ? 'bg-emerald-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {t('tabs.blocked')}
            </button>
          </div>
        )}

        {activeTab === 'blocked' && currentUser && korisnik.username === currentUser.username ? (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
              <h2 className="text-base font-semibold text-gray-900">{t('blocked.title')}</h2>
            </div>
            {blockedUsers.length === 0 ? (
              <p className="p-5 text-sm text-gray-500">{t('blocked.empty')}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {blockedUsers.map((u) => (
                  <li key={u.id} className="p-4">
                    <Link to={`/korisnik/${u.username}`} className="flex items-center gap-3 hover:text-emerald-700">
                      <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center font-bold text-emerald-700">
                        {(u.fullName || u.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{u.fullName || u.username}</p>
                        <p className="text-xs text-gray-500 truncate">@{u.username}{u.klubNaziv ? ` · ${u.klubNaziv}` : ''}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Osnovni podaci */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
              <div className="flex items-center gap-2">
                <UserCircleIcon className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-semibold text-gray-900">{t('sections.basic')}</h2>
              </div>
            </div>
            <div className="p-5 divide-y divide-gray-100 -mx-1">

              <InfoRow label={t('labels.fullName')} value={korisnik.fullName} alwaysShow icon={UserCircleIcon} />
              <InfoRow label={t('labels.username')} value={korisnik.username} alwaysShow icon={UserCircleIcon} />
              <InfoRow label={t('labels.email')} value={korisnik.email ? <a href={`mailto:${korisnik.email}`} className="text-emerald-600 hover:underline">{korisnik.email}</a> : undefined} alwaysShow icon={EnvelopeIcon} />
              <InfoRow label={t('labels.phone')} value={korisnik.telefon ? <a href={`tel:${korisnik.telefon}`} className="text-emerald-600 hover:underline">{korisnik.telefon}</a> : undefined} alwaysShow icon={PhoneIcon} />
              <InfoRow label={t('labels.role')} value={getRoleLabel(korisnik.role)} icon={UserCircleIcon} />
              <InfoRow label={t('labels.registeredAt')} value={formatDate(korisnik.createdAt)} alwaysShow icon={CalendarDaysIcon} />
              <InfoRow label={t('labels.updatedAt')} value={formatDate(korisnik.updatedAt)} alwaysShow icon={CalendarDaysIcon} />
            </div>
          </div>

          {/* Lični podaci */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
              <div className="flex items-center gap-2">
                <IdentificationIcon className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-semibold text-gray-900">{t('sections.personal')}</h2>
              </div>
            </div>
            <div className="p-5 divide-y divide-gray-100 -mx-1">
              <InfoRow label={t('labels.parentName')} value={korisnik.ime_roditelja} alwaysShow icon={IdentificationIcon} />
              <InfoRow label={t('labels.gender')} value={korisnik.pol === 'M' ? t('gender.male') : korisnik.pol === 'Ž' ? t('gender.female') : t('shared:taskCard.empty')} alwaysShow icon={IdentificationIcon} />
              <InfoRow label={t('labels.birthDate')} value={formatDate(korisnik.datum_rodjenja ?? undefined)} alwaysShow icon={CalendarDaysIcon} />
              <InfoRow label={t('labels.citizenship')} value={korisnik.drzavljanstvo} alwaysShow icon={IdentificationIcon} />
              <InfoRow label={t('labels.address')} value={korisnik.adresa} alwaysShow icon={MapPinIcon} />
              <InfoRow label={t('labels.idCard')} value={korisnik.broj_licnog_dokumenta} alwaysShow icon={DocumentTextIcon} />
            </div>
          </div>

          {/* Planinarski podaci */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-semibold text-gray-900">{t('sections.hiking')}</h2>
              </div>
            </div>
            <div className="p-5 divide-y divide-gray-100 -mx-1">
              <InfoRow label={t('labels.hikingCard')} value={korisnik.broj_planinarske_legitimacije} alwaysShow icon={DocumentTextIcon} />
              <InfoRow label={t('labels.hikingBadge')} value={korisnik.broj_planinarske_markice} alwaysShow icon={DocumentTextIcon} />
              <InfoRow label={t('labels.memberSince')} value={formatDate(korisnik.datum_uclanjenja ?? undefined)} alwaysShow icon={CalendarDaysIcon} />
              <InfoRow label={t('labels.totalKm')} value={korisnik.ukupnoKm != null ? `${Number(korisnik.ukupnoKm).toFixed(1)} km` : undefined} alwaysShow icon={DocumentTextIcon} />
              <InfoRow label={t('labels.totalAscent')} value={korisnik.ukupnoMetaraUspona != null ? `${korisnik.ukupnoMetaraUspona.toLocaleString(i18n.language)} m` : undefined} alwaysShow icon={DocumentTextIcon} />
              <InfoRow label={t('labels.actionsClimbed')} value={korisnik.brojPopeoSe != null ? String(korisnik.brojPopeoSe) : undefined} alwaysShow icon={DocumentTextIcon} />
            </div>
          </div>

          {/* Napomene i ostalo */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
              <div className="flex items-center gap-2">
                <ClipboardDocumentListIcon className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-semibold text-gray-900">{t('sections.notes')}</h2>
              </div>
            </div>
            <div className="p-5 divide-y divide-gray-100 -mx-1">
              <InfoRow label={t('labels.disciplinary')} value={korisnik.izrecene_disciplinske_kazne} alwaysShow icon={ClipboardDocumentListIcon} />
              <InfoRow label={t('labels.selectionBodies')} value={korisnik.izbor_u_organe_sportskog_udruzenja} alwaysShow icon={ClipboardDocumentListIcon} />
              <InfoRow label={t('labels.notes')} value={korisnik.napomene} alwaysShow icon={ClipboardDocumentListIcon} />
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
