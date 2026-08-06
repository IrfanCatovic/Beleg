import { useCallback, useEffect, useRef, useState } from 'react'
import type { AkcijaDetail } from '@beleg/shared'
import { isActionCancelled } from '@beleg/shared'
import {
  decideSummitClaimIntent,
  isSummitRewardEligible,
} from '@beleg/shared'
import { isFerrataSummitAction } from '../utils/summitShareData'

type NavigationLike = {
  setParams: (params: { claimReward?: undefined }) => void
}

export function useSummitShare(opts: {
  isLoggedIn: boolean
  akcija: AkcijaDetail | undefined
  akcijaLoaded: boolean
  participationStatus: string | null | undefined
  participationLoaded: boolean
  claimRewardParam: boolean
  navigation: NavigationLike
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [openCount, setOpenCount] = useState(0)
  const [initialStep, setInitialStep] = useState<'format' | 'badge'>('format')
  const intentConsumedRef = useRef(false)

  const isLoaded = opts.akcijaLoaded && opts.participationLoaded
  const isCancelled = opts.akcija ? isActionCancelled(opts.akcija) : false
  const isCompleted = !!opts.akcija?.isCompleted

  const eligible = isSummitRewardEligible({
    isLoggedIn: opts.isLoggedIn,
    isLoaded,
    isCompleted,
    isCancelled,
    participationStatus: opts.participationStatus,
  })

  const clearClaimParam = useCallback(() => {
    try {
      opts.navigation.setParams({ claimReward: undefined })
    } catch {
      // ignore
    }
  }, [opts.navigation])

  const openManual = useCallback(() => {
    if (!opts.akcija) return
    setInitialStep(isFerrataSummitAction(opts.akcija) ? 'badge' : 'format')
    setOpenCount((n) => n + 1)
    setModalOpen(true)
  }, [opts.akcija])

  const closeModal = useCallback(() => {
    setModalOpen(false)
  }, [])

  useEffect(() => {
    const decision = decideSummitClaimIntent({
      claimReward: opts.claimRewardParam,
      alreadyConsumed: intentConsumedRef.current,
      modalOpen,
      isLoggedIn: opts.isLoggedIn,
      isLoaded,
      isCompleted,
      isCancelled,
      participationStatus: opts.participationStatus,
    })

    if (decision.action === 'wait' || decision.action === 'noop') return

    intentConsumedRef.current = true
    clearClaimParam()

    if (decision.action !== 'open' || !opts.akcija) return

    const step: 'format' | 'badge' = isFerrataSummitAction(opts.akcija) ? 'badge' : 'format'
    queueMicrotask(() => {
      setInitialStep(step)
      setOpenCount((n) => n + 1)
      setModalOpen(true)
    })
  }, [
    opts.claimRewardParam,
    opts.isLoggedIn,
    opts.participationStatus,
    opts.akcija,
    isLoaded,
    isCompleted,
    isCancelled,
    modalOpen,
    clearClaimParam,
  ])

  return {
    showCard: eligible,
    modalOpen,
    openCount,
    initialStep,
    openManual,
    closeModal,
  }
}
