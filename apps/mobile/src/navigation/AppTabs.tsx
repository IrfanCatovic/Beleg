import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { HomeStack } from './stacks/HomeStack'
import { ActionsStack } from './stacks/ActionsStack'
import { ExploreStack } from './stacks/ExploreStack'
import { ClubStack } from './stacks/ClubStack'
import { ProfileStack } from './stacks/ProfileStack'
import { colors, radius } from '../theme'
import type { AppTabsParamList } from './types'

const Tab = createBottomTabNavigator<AppTabsParamList>()

const TAB_BAR_HEIGHT = 60
const TAB_BAR_PADDING = 6

function TabIcon({ name, focused }: { name: keyof typeof Ionicons.glyphMap; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} size={22} color={focused ? colors.textOnDark : colors.textOnDarkMuted} />
    </View>
  )
}

export function AppTabs() {
  const insets = useSafeAreaInsets()

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.textOnDark,
        tabBarInactiveTintColor: colors.textOnDarkMuted,
        tabBarStyle: [
          styles.tabBar,
          {
            height: TAB_BAR_HEIGHT + insets.bottom,
            paddingBottom: insets.bottom + TAB_BAR_PADDING,
          },
        ],
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ActionsTab"
        component={ActionsStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'trail-sign' : 'trail-sign-outline'} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="ExploreTab"
        component={ExploreStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'compass' : 'compass-outline'} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ClubTab"
        component={ClubStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'people' : 'people-outline'} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
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
    paddingTop: TAB_BAR_PADDING,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
})
