import type { NavigatorScreenParams } from '@react-navigation/native'

export type HomeStackParamList = {
  Feed: undefined
  ActionDetail: { id: number }
  FerrataDetail: { slug: string }
  UserProfile: { username?: string; id?: number }
  PostDetail: { id: number; focusComment?: boolean }
  NotificationsList: undefined
  NotificationDetail: { id: number }
}

export type ActionsStackParamList = {
  ActionsList: undefined
  ActionDetail: { id: number }
  ActionWizard: {
    tip: 'planina' | 'via_ferrata'
    bookingId?: number
    peakId?: number
    ferrataId?: number
    organizator?: string
  }
  AddPastAction: { tip: 'planina' | 'via_ferrata' }
  UserProfile: { username?: string; id?: number }
}

export type ExploreStackParamList = {
  ExploreHome: undefined
  Steps: undefined
  FerrataList: undefined
  FerrataDetail: { slug: string }
  ActionDetail: { id: number }
  Guides: undefined
  Map: undefined
  UserProfile: { username?: string; id?: number }
}

export type ClubStackParamList = {
  ClubHome: undefined
  ClubMembers: undefined
  Tasks: undefined
  Finance: undefined
  UserProfile: { username?: string; id?: number }
  ActionDetail: { id: number }
}

export type ProfileStackParamList = {
  MyProfile: undefined
  ProfileSettings: { id?: number } | undefined
  Finance: undefined
  Tasks: undefined
  UserProfile: { username?: string; id?: number }
  ActionDetail: { id: number }
}

export type AppTabsParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>
  ActionsTab: NavigatorScreenParams<ActionsStackParamList>
  ExploreTab: NavigatorScreenParams<ExploreStackParamList>
  ClubTab: NavigatorScreenParams<ClubStackParamList>
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>
}

export type AuthStackParamList = {
  Login: undefined
  Register: undefined
  ForgotPassword: undefined
}
