import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ClubInviteCodeForAdmin } from '../../domain/invite'
import {
  fetchClubInviteCodeForAdmin,
  getRegenerateCooldownMs,
  regenerateClubInviteCode,
} from '../../services/invite'

function formatCooldown(ms: number): string {
  if (ms <= 0) return ''
  const totalSec = Math.ceil(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function ClubInviteCodePanel() {
  const { t } = useTranslation('invite')
  const [data, setData] = useState<ClubInviteCodeForAdmin | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [regenError, setRegenError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0)

  const load = useCallback(async (silent?: boolean) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setLoadError(false)
    try {
      const d = await fetchClubInviteCodeForAdmin()
      setData(d)
      setCooldownRemainingMs(Math.max(0, d.regenAvailableInMs ?? 0))
    } catch {
      setLoadError(true)
      setData(null)
    } finally {
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setCooldownRemainingMs((prev) => {
        if (prev <= 1000) return 0
        return prev - 1000
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const copyCode = async () => {
    if (!data?.code) return
    setCopyError(false)
    try {
      await navigator.clipboard.writeText(data.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError(true)
    }
  }

  const handleRegenerate = async () => {
    if (cooldownRemainingMs > 0 || regenerating) return
    setRegenError('')
    setRegenerating(true)
    try {
      const d = await regenerateClubInviteCode()
      setData(d)
      setCooldownRemainingMs(Math.max(0, d.regenAvailableInMs ?? 0))
    } catch (err: unknown) {
      const cd = getRegenerateCooldownMs(err)
      if (cd != null && cd > 0) {
        setCooldownRemainingMs(cd)
      } else {
        setRegenError(t('adminPanel.regenError'))
      }
    } finally {
      setRegenerating(false)
    }
  }

  const expiresLabel = (iso: string | null) => {
    if (!iso) return t('adminPanel.expiresNone')
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return t('adminPanel.expiresNone')
    }
  }

  const codeLikelyExpired =
    data?.expiresAt != null && !Number.isNaN(Date.parse(data.expiresAt)) && Date.now() >= Date.parse(data.expiresAt)

  if (loading) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-4 text-sm text-emerald-900/80">
        {t('adminPanel.loading')}
      </div>
    )
  }

  if (loadError || !data) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {t('adminPanel.loadError')}
      </div>
    )
  }

  const canRegenerate = cooldownRemainingMs <= 0 && !regenerating

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-white shadow-sm px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-emerald-900 tracking-tight">{t('adminPanel.title')}</h2>
          <p className="mt-1 text-xs text-emerald-800/90 leading-relaxed max-w-xl">{t('adminPanel.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading || refreshing}
          className="shrink-0 self-start rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
        >
          {refreshing ? t('adminPanel.refreshing') : t('adminPanel.refresh')}
        </button>
      </div>

      {codeLikelyExpired ? (
        <p className="mb-3 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {t('adminPanel.expiredHint')}
        </p>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">{t('adminPanel.codeLabel')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-lg sm:text-xl font-mono font-bold tracking-[0.2em] text-gray-900 break-all">
              {data.code}
            </code>
            <button
              type="button"
              onClick={copyCode}
              className="shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition"
            >
              {copied ? t('adminPanel.copied') : t('adminPanel.copy')}
            </button>
            {copyError ? (
              <span className="text-[11px] text-rose-600 w-full sm:w-auto">{t('adminPanel.copyFailed')}</span>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] text-emerald-800/80">
            <span className="font-medium">{t('adminPanel.expiresLabel')}: </span>
            {expiresLabel(data.expiresAt)}
          </p>
        </div>

        <div className="flex flex-col items-stretch sm:items-end gap-2">
          <button
            type="button"
            disabled={!canRegenerate}
            onClick={handleRegenerate}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-45 disabled:cursor-not-allowed transition"
          >
            {regenerating ? t('adminPanel.regenerating') : t('adminPanel.regenerate')}
          </button>
          {!canRegenerate && cooldownRemainingMs > 0 && (
            <p className="text-[11px] text-emerald-800 text-right max-w-[220px] sm:text-right">
              {t('adminPanel.cooldownHint', { time: formatCooldown(cooldownRemainingMs) })}
            </p>
          )}
        </div>
      </div>

      {regenError ? (
        <p className="mt-3 text-xs text-rose-600" role="alert">
          {regenError}
        </p>
      ) : null}
    </div>
  )
}
