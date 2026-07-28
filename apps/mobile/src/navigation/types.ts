import type { NavigatorScreenParams } from '@react-navigation/native'

export type ActionDetailParams = {
  id: number
  inviteToken?: string
  claimReward?: boolean
}

export type HomeStackParamList = {
  Feed: { postId?: number } | undefined
  ActionDetail: ActionDetailParams
  ActionEdit: { id: number }
  FerrataDetail: { slug: string }
  UserProfile: { username?: string; id?: number }
  PostDetail: { id: number; focusComment?: boolean }
  NotificationsList: undefined
  NotificationDetail: { id: number }
}

export type ActionsStackParamList = {
  ActionsList: undefined
  ActionDetail: ActionDetailParams
  ActionEdit: { id: number }
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
  Adventure: undefined
  FerrataList: undefined
  FerrataDetail: { slug: string }
  ActionDetail: ActionDetailParams
  ActionEdit: { id: number }
  Guides: undefined
  Map: undefined
  UserProfile: { username?: string; id?: number }
}

export type ClubStackParamList = {
  ClubHome: undefined
  SuperadminKlubovi: undefined
  ClubMembers: undefined
  ClubManageUsers: undefined
  RegisterClubMember: undefined
  ClubMemberAdmin: { id: number }
  Tasks: undefined
  Finance: undefined
  UserProfile: { username?: string; id?: number }
  ActionDetail: ActionDetailParams
  ActionEdit: { id: number }
}

export type ProfileStackParamList = {
  MyProfile: undefined
  ProfileSettings: { id?: number } | undefined
  BecomeGuide: undefined
  Finance: undefined
  Tasks: undefined
  UserProfile: { username?: string; id?: number }
  ActionDetail: ActionDetailParams
  ActionEdit: { id: number }
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
  EnterClubInviteCode: undefined
  RegisterMember: { klubId: number; klubNaziv?: string; inviteCode: string }
  RegisterSuccess: { email?: string } | undefined
}
