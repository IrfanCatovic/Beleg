import { Linking } from 'react-native'
import type { LinkingOptions } from '@react-navigation/native'
import type { AppTabsParamList } from './types'

const webPrefix = 'https://www.planiner.com'

export const linkingPrefixes = ['planiner://', webPrefix]

export const appLinking: LinkingOptions<AppTabsParamList> = {
  prefixes: linkingPrefixes,
  config: {
    screens: {
      ActionsTab: {
        screens: {
          ActionDetail: {
            path: 'akcije/:id',
            parse: {
              id: (id: string) => Number(id),
            },
            stringify: {
              id: (id: number) => String(id),
            },
          },
        },
      },
      HomeTab: {
        screens: {
          ActionDetail: {
            path: 'akcije/:id',
            parse: {
              id: (id: string) => Number(id),
            },
          },
        },
      },
      ExploreTab: {
        screens: {
          ActionDetail: {
            path: 'akcije/:id',
            parse: {
              id: (id: string) => Number(id),
            },
          },
        },
      },
      ClubTab: {
        screens: {
          ActionDetail: {
            path: 'akcije/:id',
            parse: {
              id: (id: string) => Number(id),
            },
          },
        },
      },
      ProfileTab: {
        screens: {
          ActionDetail: {
            path: 'akcije/:id',
            parse: {
              id: (id: string) => Number(id),
            },
          },
        },
      },
    },
  },
}
