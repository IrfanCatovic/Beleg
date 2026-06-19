import { useQuery } from '@tanstack/react-query'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { HomeStack } from './stacks/HomeStack'
import { ActionsStack } from './stacks/ActionsStack'
import { ExploreStack } from './stacks/ExploreStack'
import { NotificationsStack } from './stacks/NotificationsStack'
import { ProfileStack } from './stacks/ProfileStack'
import { colors, radius } from '../theme'
import { client } from '../api/client'
import { fetchUnreadCount } from '@beleg/shared/services'
import type { AppTabsParamList } from './types'

const Tab = createBottomTabNavigator<AppTabsParamList>()

function TabIcon({ name, focused }: { name: keyof typeof Ionicons.glyphMap; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} size={22} color={focused ? colors.textOnDark : colors.textOnDarkMuted} />
    </View>
  )
}

export function AppTabs() {
  const { t } = useTranslation('tabs')
  const { data: unread = 0 } = useQuery({
    queryKey: ['obavestenja', 'unread'],
    queryFn: () => fetchUnreadCount(client),
    refetchInterval: 60_000,
  })

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.textOnDark,
        tabBarInactiveTintColor: colors.textOnDarkMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          title: t('home'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ActionsTab"
        component={ActionsStack}
        options={{
          title: t('actions'),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'trail-sign' : 'trail-sign-outline'} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="ExploreTab"
        component={ExploreStack}
        options={{
          title: t('explore'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'compass' : 'compass-outline'} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsStack}
        options={{
          title: t('notifications'),
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarBadgeStyle: styles.badge,
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'notifications' : 'notifications-outline'} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          title: t('profile'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} />,
        }}
      />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.navBgMid,
    borderTopColor: colors.navBorder,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabLabel: { fontSize: 10, fontWeight: '600' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  badge: {
    backgroundColor: colors.rose,
    fontSize: 10,
    minWidth: 16,
    height: 16,
  },
})
