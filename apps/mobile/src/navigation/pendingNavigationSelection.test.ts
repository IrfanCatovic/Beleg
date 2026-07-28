import { describe, expect, it } from 'vitest'
import { selectPendingNavigation } from './pendingNavigationSelection'
import type { PendingNotificationTarget } from '../features/notifications/pendingNotificationTarget'

const url = (savedAt: number) => ({
  url: 'planiner://akcije/10',
  savedAt,
})

const push = (savedAt: number): PendingNotificationTarget => ({
  kind: 'notification-detail',
  notificationId: 4,
  dedupeKey: 'notif:4',
  savedAt,
})

describe('selectPendingNavigation', () => {
  it('only URL → URL selected', () => {
    expect(selectPendingNavigation(url(100), null)).toEqual({
      selected: { source: 'url', savedAt: 100, target: url(100) },
      superseded: [],
    })
  })

  it('only push → push selected', () => {
    expect(selectPendingNavigation(null, push(200))).toEqual({
      selected: { source: 'push', savedAt: 200, target: push(200) },
      superseded: [],
    })
  })

  it('newer push → push selected', () => {
    const result = selectPendingNavigation(url(100), push(200))
    expect(result?.selected.source).toBe('push')
    expect(result?.superseded).toHaveLength(1)
    expect(result?.superseded[0]?.source).toBe('url')
  })

  it('newer URL → URL selected', () => {
    const result = selectPendingNavigation(url(300), push(200))
    expect(result?.selected.source).toBe('url')
    expect(result?.superseded[0]?.source).toBe('push')
  })

  it('equal savedAt → push wins (stable tie-breaker)', () => {
    const result = selectPendingNavigation(url(500), push(500))
    expect(result?.selected.source).toBe('push')
    expect(result?.superseded[0]?.source).toBe('url')
  })

  it('newer URL + legacy push (savedAt 0) → URL', () => {
    expect(selectPendingNavigation(url(1), push(0))?.selected.source).toBe('url')
  })

  it('newer push + legacy URL → push', () => {
    expect(selectPendingNavigation(url(0), push(1))?.selected.source).toBe('push')
  })

  it('both legacy → push tie-breaker', () => {
    expect(selectPendingNavigation(url(0), push(0))?.selected.source).toBe('push')
  })

  it('one side null → other valid', () => {
    expect(selectPendingNavigation(null, push(0))?.selected.source).toBe('push')
    expect(selectPendingNavigation(url(0), null)?.selected.source).toBe('url')
  })

  it('both null → null', () => {
    expect(selectPendingNavigation(null, null)).toBeNull()
  })

  it('newer reward push keeps claimReward when selected', () => {
    const rewardPush: PendingNotificationTarget = {
      kind: 'action-detail',
      actionId: 10,
      claimReward: true,
      dedupeKey: 'action:10:1',
      savedAt: 200,
    }
    const result = selectPendingNavigation(url(100), rewardPush)
    expect(result?.selected.source).toBe('push')
    expect(result?.selected.target).toMatchObject({ claimReward: true, actionId: 10 })
  })

  it('newer URL supersedes reward push (push is superseded)', () => {
    const rewardPush: PendingNotificationTarget = {
      kind: 'action-detail',
      actionId: 10,
      claimReward: true,
      dedupeKey: 'action:10:1',
      savedAt: 100,
    }
    const result = selectPendingNavigation(url(300), rewardPush)
    expect(result?.selected.source).toBe('url')
    expect(result?.superseded[0]?.target).toMatchObject({ claimReward: true })
  })

  it('does not mutate input objects', () => {
    const u = url(10)
    const p = push(20)
    const uCopy = { ...u }
    const pCopy = { ...p }
    selectPendingNavigation(u, p)
    expect(u).toEqual(uCopy)
    expect(p).toEqual(pCopy)
  })
})
