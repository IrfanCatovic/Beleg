import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import type { AkcijaDetail } from '@beleg/shared/types'
import type { SessionUser } from '@beleg/shared'
import { fetchMyGuideRatingForAction, submitGuideRatingForAction } from '@beleg/shared/services'
import { client } from '../../../api/client'

interface MojaPrijavaLike {
  status?: string
}

export function useGuideRatings(options: {
  actionId: number
  user: SessionUser | null
  akcija: AkcijaDetail | undefined
  mojaPrijava: MojaPrijavaLike | undefined
  showAlert: (title: string, message?: string) => Promise<unknown>
}) {
  const { actionId, user, akcija, mojaPrijava, showAlert } = options
  const [guideRatingOpen, setGuideRatingOpen] = useState(false)
  const [guideRatingSubmitted, setGuideRatingSubmitted] = useState(false)
  const [guideRatingSkipped, setGuideRatingSkipped] = useState(false)
  const [guideRatingSaving, setGuideRatingSaving] = useState(false)
  const [guideRatingChecked, setGuideRatingChecked] = useState(false)

  useEffect(() => {
    if (!user || !akcija?.isCompleted) {
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

    let cancelled = false
    void (async () => {
      const skipKey = `guide-rating-skip-${actionId}`
      const skipped = await AsyncStorage.getItem(skipKey)
      if (skipped === '1') {
        if (!cancelled) {
          setGuideRatingSkipped(true)
          setGuideRatingChecked(true)
        }
        return
      }
      try {
        const res = await fetchMyGuideRatingForAction(client, actionId)
        if (cancelled) return
        if (res.submitted) setGuideRatingSubmitted(true)
        else setGuideRatingOpen(true)
        setGuideRatingChecked(true)
      } catch {
        if (!cancelled) setGuideRatingChecked(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, actionId, akcija?.isCompleted, akcija?.vodicId, akcija?.vodic?.username, mojaPrijava?.status])

  const guideRatingGuideName =
    akcija?.vodic?.fullName?.trim() || akcija?.vodic?.username || 'Vodič'

  const canShowGuideRatingPrompt =
    !!user &&
    !!akcija?.isCompleted &&
    mojaPrijava?.status === 'popeo se' &&
    (akcija.vodicId ?? 0) > 0 &&
    akcija.vodic?.username !== user.username &&
    guideRatingChecked &&
    !guideRatingSubmitted &&
    !guideRatingSkipped

  const handleGuideRatingSubmit = async (payload: { ocena?: number; komentar?: string }) => {
    setGuideRatingSaving(true)
    try {
      await submitGuideRatingForAction(client, actionId, payload)
      setGuideRatingSubmitted(true)
      setGuideRatingOpen(false)
    } catch {
      await showAlert('Greška', 'Ocena nije sačuvana.')
    } finally {
      setGuideRatingSaving(false)
    }
  }

  const handleGuideRatingSkip = async () => {
    await AsyncStorage.setItem(`guide-rating-skip-${actionId}`, '1')
    setGuideRatingSkipped(true)
    setGuideRatingOpen(false)
  }

  return {
    guideRatingOpen,
    setGuideRatingOpen,
    guideRatingSubmitted,
    guideRatingSkipped,
    guideRatingSaving,
    guideRatingGuideName,
    canShowGuideRatingPrompt,
    handleGuideRatingSubmit,
    handleGuideRatingSkip,
  }
}
