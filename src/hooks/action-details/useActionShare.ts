import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  buildActionInviteWhatsAppMessage,
  buildActionShareUrl,
  encodeWhatsAppShareMessage,
  isActionCancelled,
  isActionLifecycleActive,
  resolveActionInviteShareUrl,
} from '@beleg/shared'
import api from '../../services/api'
import { getApiErrorMessage } from '../../utils/apiError'
import { canManageHostAkcija } from '../../utils/canManageAkcija'
import type { User } from '../../context/AuthContext'
import { formatDate } from '../../utils/dateUtils'
import {
  downloadFerrataBadgePng,
  getFerrataBadgePreviewDataUrl,
} from '../../utils/generateFerrataBadgePng'
import {
  downloadSummitSuccessPng,
  getSummitLayoutPreviewDataUrl,
  type SummitAspect,
  type SummitLayout,
} from '../../utils/generateSummitPng'
import type { Akcija } from '../../types/akcija'
import type { MojaPrijava } from './useActionRegistration'

export interface UseActionShareParams {
  id: string | undefined
  akcija: Akcija | null
  user: User | null
  inviteToken: string
  claimRewardRequested: boolean
  mojaPrijava: MojaPrijava | undefined
  canManageHost: boolean
  showAlert: (message: string, title?: string) => Promise<void>
  t: (key: string, options?: Record<string, unknown>) => string
  i18nLanguage: string
}

export function useActionShare({
  id,
  akcija,
  user,
  inviteToken,
  claimRewardRequested,
  mojaPrijava,
  canManageHost,
  showAlert,
  t,
  i18nLanguage,
}: UseActionShareParams) {
  const location = useLocation()
  const navigate = useNavigate()

  const [summitShareOpen, setSummitShareOpen] = useState(false)
  const [summitShareStep, setSummitShareStep] = useState<0 | 1 | 2>(0)
  const [summitPickedAspect, setSummitPickedAspect] = useState<SummitAspect | null>(null)
  const [summitPreviewBalanced, setSummitPreviewBalanced] = useState<string | null>(null)
  const [summitPreviewStacked, setSummitPreviewStacked] = useState<string | null>(null)
  const [ferrataBadgePreview, setFerrataBadgePreview] = useState<string | null>(null)
  const [summitPreviewLoading, setSummitPreviewLoading] = useState(false)
  const [actionShareUrl, setActionShareUrl] = useState('')
  const [actionShareLoading, setActionShareLoading] = useState(false)
  const [actionShareCopied, setActionShareCopied] = useState(false)
  const [actionShareError, setActionShareError] = useState('')

  useEffect(() => {
    if (!summitShareOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSummitShareOpen(false)
        setSummitShareStep(0)
        setSummitPickedAspect(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [summitShareOpen])

  useEffect(() => {
    if (!akcija) {
      setSummitPreviewBalanced(null)
      setSummitPreviewStacked(null)
      setFerrataBadgePreview(null)
      setSummitPreviewLoading(false)
      return
    }

    const isFerrataReward = akcija.tipAkcije === 'via_ferrata'
    const ferrataPayload = {
      id: akcija.id,
      naziv: akcija.naziv,
      vrh: akcija.vrh,
      datum: akcija.datum,
      tezina: akcija.tezina,
      ferrataSnapshot: akcija.ferrataSnapshot,
    }

    if (isFerrataReward) {
      if (summitShareStep !== 1) {
        setFerrataBadgePreview(null)
        setSummitPreviewLoading(false)
        return
      }
      let cancelled = false
      setFerrataBadgePreview(null)
      setSummitPreviewLoading(true)
      void (async () => {
        try {
          const preview = await getFerrataBadgePreviewDataUrl(ferrataPayload, 220)
          if (!cancelled) setFerrataBadgePreview(preview)
        } catch {
          if (!cancelled) setFerrataBadgePreview(null)
        } finally {
          if (!cancelled) setSummitPreviewLoading(false)
        }
      })()
      return () => {
        cancelled = true
      }
    }

    if (summitShareStep !== 2 || !summitPickedAspect) {
      setSummitPreviewBalanced(null)
      setSummitPreviewStacked(null)
      setSummitPreviewLoading(false)
      return
    }
    let cancelled = false
    const payload = {
      id: akcija.id,
      naziv: akcija.naziv,
      planina: akcija.planina,
      vrh: akcija.vrh,
      datum: akcija.datum,
      tipAkcije: akcija.tipAkcije,
      duzinaStazeKm: akcija.duzinaStazeKm,
      kumulativniUsponM: akcija.kumulativniUsponM,
      visinaVrhM: akcija.visinaVrhM,
      zimskiUspon: akcija.zimskiUspon,
      tezina: akcija.tezina,
    }
    const labels = {
      mountain: t('mountain'),
      peak: t('peak'),
      trail: t('summitPngTrail'),
      ascent: t('summitPngAscent'),
      date: t('date'),
      per: t('summitPngPer'),
      ferrata: t('summitPngFerrata'),
    }
    const dateFormatted = formatDate(akcija.datum)
    setSummitPreviewBalanced(null)
    setSummitPreviewStacked(null)
    setSummitPreviewLoading(true)
    void (async () => {
      try {
        const previewW = summitPickedAspect === '9:16' ? 140 : 200
        const [b, s] = await Promise.all([
          getSummitLayoutPreviewDataUrl(payload, summitPickedAspect, 'balanced', labels, dateFormatted, previewW),
          getSummitLayoutPreviewDataUrl(payload, summitPickedAspect, 'stacked', labels, dateFormatted, previewW),
        ])
        if (!cancelled) {
          setSummitPreviewBalanced(b)
          setSummitPreviewStacked(s)
        }
      } catch {
        if (!cancelled) {
          setSummitPreviewBalanced(null)
          setSummitPreviewStacked(null)
        }
      } finally {
        if (!cancelled) setSummitPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [summitShareStep, summitPickedAspect, akcija, i18nLanguage, t])

  const resolveActionPublicUrl = () => {
    if (!akcija) return ''
    const base =
      (typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : '').replace(/\/$/, '')
    return buildActionShareUrl(base || '', akcija.id)
  }

  const ensureShareUrl = async (): Promise<string> => {
    if (!akcija) return ''
    setActionShareError('')
    setActionShareCopied(false)

    const webBase =
      (typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : '').replace(/\/$/, '')

    const needsFetch =
      !inviteToken &&
      !akcija.javna &&
      canManageHost &&
      !actionShareUrl

    if (needsFetch) {
      setActionShareLoading(true)
    }

    try {
      const url = await resolveActionInviteShareUrl(api, {
        actionId: akcija.id,
        isPublic: !!akcija.javna,
        webBaseUrl: webBase,
        inviteToken,
        canManageHost,
        cachedUrl: actionShareUrl,
      })
      setActionShareUrl(url)
      return url
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'PRIVATE_SHARE_FORBIDDEN') {
        const fallback = resolveActionPublicUrl()
        setActionShareUrl(fallback)
        return fallback
      }
      const message = getApiErrorMessage(err, 'Neuspešno kreiranje share linka.')
      setActionShareError(message)
      return ''
    } finally {
      if (needsFetch) {
        setActionShareLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!claimRewardRequested) return
    if (!user || !akcija) return
    if (mojaPrijava === undefined) return
    if (mojaPrijava?.status !== 'popeo se') return
    if (summitShareOpen) return

    const run = async () => {
      setSummitPickedAspect(null)
      setSummitShareOpen(true)
      setSummitShareStep(1)
      setActionShareError('')
      setActionShareCopied(false)

      if (inviteToken) {
        setActionShareUrl(buildActionShareUrl(
          (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '').replace(/\/$/, ''),
          akcija.id,
          inviteToken,
        ))
      } else if (akcija.javna || !canManageHostAkcija(user, {
        klubId: akcija.klubId,
        organizatorTip: akcija.organizatorTip,
        vodicId: akcija.vodicId,
        vodicUsername: akcija.vodic?.username,
        addedByUsername: akcija.addedBy?.username,
      })) {
        setActionShareUrl(resolveActionPublicUrl())
      } else if (!actionShareUrl) {
        setActionShareLoading(true)
        try {
          const url = await resolveActionInviteShareUrl(api, {
            actionId: akcija.id,
            isPublic: false,
            webBaseUrl: (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '').replace(/\/$/, ''),
            canManageHost: true,
          })
          setActionShareUrl(url)
        } catch (err: unknown) {
          setActionShareError(getApiErrorMessage(err, 'Neuspešno kreiranje share linka.'))
        } finally {
          setActionShareLoading(false)
        }
      }

      navigate(location.pathname, { replace: true })
    }

    void run()
  }, [claimRewardRequested, user, akcija, mojaPrijava, summitShareOpen, inviteToken, actionShareUrl, id, navigate, location.pathname])

  const closeSummitShareModal = () => {
    setSummitShareOpen(false)
    setSummitShareStep(0)
    setSummitPickedAspect(null)
    setFerrataBadgePreview(null)
    setActionShareCopied(false)
    setActionShareError('')
  }

  const openSummitShareModal = async () => {
    setSummitShareStep(0)
    setSummitPickedAspect(null)
    setSummitShareOpen(true)
    await ensureShareUrl()
  }

  const copyActionShareLink = async () => {
    const url = actionShareUrl || (await ensureShareUrl())
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setActionShareCopied(true)
      window.setTimeout(() => setActionShareCopied(false), 1600)
    } catch {
      await showAlert('Kopiranje nije uspelo. Link možete ručno kopirati.', t('errorTitle'))
    }
  }

  const shareActionViaWhatsApp = async () => {
    if (!akcija) return
    const url = await ensureShareUrl()
    if (!url) {
      if (actionShareError) {
        await showAlert(actionShareError, t('errorTitle'))
      }
      return
    }
    const message = buildActionInviteWhatsAppMessage(akcija.naziv, url)
    const { webUrl } = encodeWhatsAppShareMessage(message)
    window.open(webUrl, '_blank', 'noopener,noreferrer')
  }

  const canShareActionInvite =
    !!akcija &&
    isActionLifecycleActive(akcija) &&
    (!!akcija.javna || canManageHost || !!inviteToken)

  const clearActionShareCache = () => {
    setActionShareUrl('')
    setActionShareCopied(false)
    setActionShareError('')
    setActionShareLoading(false)
  }

  useEffect(() => {
    if (isActionCancelled(akcija)) {
      clearActionShareCache()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [akcija?.id, akcija?.isCancelled])

  const handleFerrataBadgeDownload = async () => {
    if (!akcija) return
    try {
      await downloadFerrataBadgePng({
        id: akcija.id,
        naziv: akcija.naziv,
        vrh: akcija.vrh,
        datum: akcija.datum,
        tezina: akcija.tezina,
        ferrataSnapshot: akcija.ferrataSnapshot,
      })
      closeSummitShareModal()
    } catch {
      await showAlert(t('summitPngError'), t('errorTitle'))
    }
  }

  const handleSummitPngDownload = async (aspect: SummitAspect, layout: SummitLayout) => {
    if (!akcija) return
    try {
      await downloadSummitSuccessPng(
        {
          id: akcija.id,
          naziv: akcija.naziv,
          planina: akcija.planina,
          vrh: akcija.vrh,
          datum: akcija.datum,
          tipAkcije: akcija.tipAkcije,
          duzinaStazeKm: akcija.duzinaStazeKm,
          kumulativniUsponM: akcija.kumulativniUsponM,
          visinaVrhM: akcija.visinaVrhM,
          zimskiUspon: akcija.zimskiUspon,
          tezina: akcija.tezina,
        },
        aspect,
        layout,
        {
          mountain: t('mountain'),
          peak: t('peak'),
          trail: t('summitPngTrail'),
          ascent: t('summitPngAscent'),
          date: t('date'),
          per: t('summitPngPer'),
          ferrata: t('summitPngFerrata'),
        },
        formatDate(akcija.datum),
      )
      closeSummitShareModal()
    } catch {
      await showAlert(t('summitPngError'), t('errorTitle'))
    }
  }

  const isFerrataReward = akcija?.tipAkcije === 'via_ferrata'
  const canClaimSummitReward =
    !!user && mojaPrijava !== undefined && mojaPrijava?.status === 'popeo se'

  return {
    summitShareOpen,
    setSummitShareOpen,
    summitShareStep,
    setSummitShareStep,
    summitPickedAspect,
    setSummitPickedAspect,
    summitPreviewBalanced,
    summitPreviewStacked,
    ferrataBadgePreview,
    summitPreviewLoading,
    actionShareUrl,
    actionShareLoading,
    actionShareCopied,
    actionShareError,
    isFerrataReward,
    canClaimSummitReward,
    resolveActionPublicUrl,
    closeSummitShareModal,
    openSummitShareModal,
    copyActionShareLink,
    shareActionViaWhatsApp,
    canShareActionInvite,
    clearActionShareCache,
    handleFerrataBadgeDownload,
    handleSummitPngDownload,
    ensureShareUrl,
  }
}
