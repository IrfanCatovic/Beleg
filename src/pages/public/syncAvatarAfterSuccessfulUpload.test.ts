import { describe, expect, it, vi } from 'vitest'
import { syncAvatarAfterSuccessfulUpload } from './syncAvatarAfterSuccessfulUpload'

describe('syncAvatarAfterSuccessfulUpload', () => {
  it('applies backend avatar URL then calls refreshUser once', async () => {
    const applyLocalAvatar = vi.fn()
    const refreshUser = vi.fn(async () => true)

    const result = await syncAvatarAfterSuccessfulUpload({
      avatarUrl: 'https://cdn.example/new-avatar.jpg',
      applyLocalAvatar,
      refreshUser,
    })

    expect(applyLocalAvatar).toHaveBeenCalledTimes(1)
    expect(applyLocalAvatar).toHaveBeenCalledWith('https://cdn.example/new-avatar.jpg')
    expect(refreshUser).toHaveBeenCalledTimes(1)
    expect(result.refreshed).toBe(true)
  })

  it('does not pass blob/preview URLs — only the provided backend URL', async () => {
    const applyLocalAvatar = vi.fn()
    const refreshUser = vi.fn(async () => true)
    const backendUrl = 'https://res.cloudinary.com/x/avatar-v2.jpg'

    await syncAvatarAfterSuccessfulUpload({
      avatarUrl: backendUrl,
      applyLocalAvatar,
      refreshUser,
    })

    expect(applyLocalAvatar.mock.calls[0][0]).toBe(backendUrl)
    expect(String(applyLocalAvatar.mock.calls[0][0])).not.toMatch(/^blob:/)
  })

  it('still finishes when refreshUser fails after successful upload', async () => {
    const applyLocalAvatar = vi.fn()
    const refreshUser = vi.fn(async () => {
      throw new Error('network')
    })

    const result = await syncAvatarAfterSuccessfulUpload({
      avatarUrl: 'https://cdn.example/a.jpg',
      applyLocalAvatar,
      refreshUser,
    })

    expect(applyLocalAvatar).toHaveBeenCalledTimes(1)
    expect(refreshUser).toHaveBeenCalledTimes(1)
    expect(result.refreshed).toBe(false)
  })

  it('refreshUser returning false does not throw or re-upload', async () => {
    const applyLocalAvatar = vi.fn()
    const refreshUser = vi.fn(async () => false)

    const result = await syncAvatarAfterSuccessfulUpload({
      avatarUrl: 'https://cdn.example/a.jpg',
      applyLocalAvatar,
      refreshUser,
    })

    expect(result.refreshed).toBe(false)
    expect(refreshUser).toHaveBeenCalledTimes(1)
  })

  it('remove avatar clears local state then refreshes AuthContext', async () => {
    const applyLocalAvatar = vi.fn()
    const clearLocalAvatar = vi.fn()
    const refreshUser = vi.fn(async () => true)

    await syncAvatarAfterSuccessfulUpload({
      avatarUrl: undefined,
      removed: true,
      applyLocalAvatar,
      clearLocalAvatar,
      refreshUser,
    })

    expect(clearLocalAvatar).toHaveBeenCalledTimes(1)
    expect(applyLocalAvatar).not.toHaveBeenCalled()
    expect(refreshUser).toHaveBeenCalledTimes(1)
  })
})
