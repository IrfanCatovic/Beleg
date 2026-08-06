import { describe, expect, it } from 'vitest'

/**
 * Read-only architecture audit for reward-to-feed V1/V2 readiness.
 * Documents current create-post entry points without implementing.
 */

const WEB_CREATE_POST = {
  component: 'src/pages/protected/Home.tsx',
  acceptsInitialText: false,
  acceptsInitialMediaUri: false,
  navigationParams: false,
  stateFields: ['newPostContent', 'newPostImage (File)'],
}

const MOBILE_CREATE_POST = {
  component: 'apps/mobile/src/features/home/HomeScreen.tsx',
  acceptsInitialText: false,
  acceptsInitialMediaUri: false,
  navigationParams: false,
  stateFields: ['composer text + image picker'],
}

const POST_MODEL = {
  actionIdField: false,
  achievementMetadata: false,
  imageField: 'imageUrl (remote after upload)',
  v1WithoutMigration: true,
}

describe('reward-to-feed readiness audit', () => {
  it('web Home compose accepts only in-screen state', () => {
    expect(WEB_CREATE_POST.acceptsInitialText).toBe(false)
    expect(WEB_CREATE_POST.acceptsInitialMediaUri).toBe(false)
  })

  it('mobile HomeScreen compose accepts only in-screen state', () => {
    expect(MOBILE_CREATE_POST.acceptsInitialText).toBe(false)
    expect(MOBILE_CREATE_POST.acceptsInitialMediaUri).toBe(false)
  })

  it('V1 can work as plain image post without DB migration', () => {
    expect(POST_MODEL.v1WithoutMigration).toBe(true)
    expect(POST_MODEL.actionIdField).toBe(false)
  })

  it('V2 would need actionId/achievement metadata on Post', () => {
    expect(POST_MODEL.actionIdField).toBe(false)
  })
})
