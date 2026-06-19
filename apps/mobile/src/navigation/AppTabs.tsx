import { useQuery } from '@tanstack/react-query'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { HomeStack } from './stacks/HomeStack'
import { ActionsStack } from './stacks/ActionsStack'
import { ExploreStack } from './stacks/ExploreStack'
import { NotificationsStack } from './stacks/NotificationsStack'
import { ProfileStack } from './stacks/ProfileStack'
import { colors } from '../theme'
import { client } from '../api/client'
import { fetchUnreadCount } from '@beleg/shared/services'
import type { AppTabsParamList } from './types'

const Tab = createBottomTabNavigator<AppTabsParamList>()

function tabIcon(name: keyof typeof Ionicons.glyphMap, focused: boolean) {
  return <Ionicons name={name} size={22} color={focused ? colors.brand : colors.textMuted} />
}

export function AppTabs() {
  const { data: unread = 0 } = useQuery({
    queryKey: ['obavestenja', 'unread'],
    queryFn: () => fetchUnreadCount(client),
    refetchInterval: 60_000,
  })

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          title: 'Početna',
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'home' : 'home-outline', focused),
        }}
      />
      <Tab.Screen
        name="ActionsTab"
        component={ActionsStack}
        options={{
          title: 'Akcije',
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'trail-sign' : 'trail-sign-outline', focused),
        }}
      />
      <Tab.Screen
        name="ExploreTab"
        component={ExploreStack}
        options={{
          title: 'Istraži',
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'compass' : 'compass-outline', focused),
        }}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsStack}
        options={{
          title: 'Obaveštenja',
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarIcon: ({ focused }) =>
            tabIcon(focused ? 'notifications' : 'notifications-outline', focused),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'person' : 'person-outline', focused),
        }}
      />
    </Tab.Navigator>
  )
}
