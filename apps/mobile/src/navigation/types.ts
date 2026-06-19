import type { NavigatorScreenParams } from '@react-navigation/native'

export type HomeStackParamList = {
  Feed: undefined
  ActionDetail: { id: number }
  UserProfile: { username?: string; id?: number }
  PostDetail: { id: number }
}

export type ActionsStackParamList = {
  ActionsList: undefined
  ActionDetail: { id: number }
  ActionWizard: { id?: number } | undefined
  UserProfile: { username?: string; id?: number }
}

export type ExploreStackParamList = {
  ExploreHome: undefined
  FerrataList: undefined
  FerrataDetail: { slug: string }
  Guides: undefined
  Map: undefined
  UserProfile: { username?: string; id?: number }
}

export type NotificationsStackParamList = {
  NotificationsList: undefined
  NotificationDetail: { id: number }
  ActionDetail: { id: number }
  UserProfile: { username?: string; id?: number }
}

export type ProfileStackParamList = {
  MyProfile: undefined
  ProfileSettings: { id?: number } | undefined
  Club: undefined
  Finance: undefined
  Tasks: undefined
  UserProfile: { username?: string; id?: number }
  ActionDetail: { id: number }
}

export type AppTabsParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>
  ActionsTab: NavigatorScreenParams<ActionsStackParamList>
  ExploreTab: NavigatorScreenParams<ExploreStackParamList>
  NotificationsTab: NavigatorScreenParams<NotificationsStackParamList>
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>
}

export type AuthStackParamList = {
  Login: undefined
  Register: undefined
  ForgotPassword: undefined
}
