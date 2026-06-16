import { useEffect, useState } from 'react'
import { fetchMyGuideRatingForAction, submitGuideRatingForAction } from '../../services/guideRatings'
import { getApiErrorMessage } from '../../utils/apiError'
import type { User } from '../../context/AuthContext'
import type { Akcija } from '../../types/akcija'
import type { MojaPrijava } from './useActionRegistration'

export interface UseGuideRatingsParams {
  id: string | undefined
  user: User | null
  akcija: Akcija | null
  mojaPrijava: MojaPrijava | undefined
  showAlert: (message: string, title?: string) => Promise<void>
  t: (key: string, options?: Record<string, unknown>) => string
}

export function useGuideRatings({
  id,
  user,
  akcija,
  mojaPrijava,
  showAlert,
  t,
}: UseGuideRatingsParams) {
  const [guideRatingOpen, setGuideRatingOpen] = useState(false)
  const [guideRatingSubmitted, setGuideRatingSubmitted] = useState(false)
  const [guideRatingSkipped, setGuideRatingSkipped] = useState(false)
  const [guideRatingSaving, setGuideRatingSaving] = useState(false)
  const [guideRatingChecked, setGuideRatingChecked] = useState(false)

  useEffect(() => {
    if (!user || !id || !akcija?.isCompleted) {
      setGuideRatingChecked(false)
      return
    }
    if (mojaPrijava?.status !== 'popeo se') {
      setGuideRatingChecked(false)
      return
    }
    const vodicId = akcija.vodicId ?? 0
    if (vodicId <= 0) {
      setGuideRatingChecked(true)
      return
    }
    if (akcija.vodic?.username && akcija.vodic.username === user.username) {
      setGuideRatingChecked(true)
      return
    }
    const skipKey = `guide-rating-skip-${id}`
    if (sessionStorage.getItem(skipKey) === '1') {
      setGuideRatingSkipped(true)
      setGuideRatingChecked(true)
      return
    }
    let cancelled = false
    void fetchMyGuideRatingForAction(Number(id))
      .then((res) => {
        if (cancelled) return
        if (res.submitted) setGuideRatingSubmitted(true)
        else setGuideRatingOpen(true)
        setGuideRatingChecked(true)
      })
      .catch(() => {
        if (!cancelled) setGuideRatingChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [user, id, akcija?.isCompleted, akcija?.vodicId, akcija?.vodic?.username, mojaPrijava?.status])

  const guideRatingGuideName = akcija?.vodic?.fullName?.trim() || akcija?.vodic?.username || 'Vodič'
  const canShowGuideRatingPrompt =
    !!user &&
    !!akcija?.isCompleted &&
    mojaPrijava?.status === 'popeo se' &&
    (akcija.vodicId ?? 0) > 0 &&
    akcija.vodic?.username !== user.username &&
    guideRatingChecked &&
    !guideRatingSubmitted

  const handleGuideRatingSubmit = async (payload: { ocena?: number; komentar?: string }) => {
    if (!id) return
    setGuideRatingSaving(true)
    try {
      await submitGuideRatingForAction(Number(id), payload)
      setGuideRatingSubmitted(true)
      setGuideRatingOpen(false)
      await showAlert(t('guideRatingThanks'), t('guideRatingTitle'))
    } catch (err: unknown) {
      await showAlert(getApiErrorMessage(err, t('guideRatingError')), t('errorTitle'))
    } finally {
      setGuideRatingSaving(false)
    }
  }

  const handleGuideRatingSkip = () => {
    if (id) sessionStorage.setItem(`guide-rating-skip-${id}`, '1')
    setGuideRatingSkipped(true)
    setGuideRatingOpen(false)
  }

  return {
    guideRatingOpen,
    setGuideRatingOpen,
    guideRatingSubmitted,
    guideRatingSkipped,
    guideRatingSaving,
    guideRatingChecked,
    guideRatingGuideName,
    canShowGuideRatingPrompt,
    handleGuideRatingSubmit,
    handleGuideRatingSkip,
  }
}
