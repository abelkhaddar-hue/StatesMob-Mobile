import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CalendarClock, CarFront, CircleUser } from 'lucide-react-native'
import { color, fontFamily } from '@/theme'
import { haptic } from '@/ui/haptics'

// Barre d'onglets du bas, comme une app native : réserver, mes trajets, compte.
export default function TabsLayout() {
  const { bottom } = useSafeAreaInsets()
  return (
    <Tabs
      screenListeners={{ tabPress: () => haptic.select() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color('accent'),
        tabBarInactiveTintColor: color('text-muted'),
        tabBarStyle: { backgroundColor: color('surface'), borderTopColor: color('border'), height: 68 + bottom, paddingTop: 6, paddingBottom: Math.max(bottom, 8) },
        tabBarLabelStyle: { fontFamily: fontFamily(500), fontSize: 11, lineHeight: 14, marginTop: 2 },
        sceneStyle: { backgroundColor: color('bg') },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Book', tabBarIcon: ({ color: c, size }) => <CarFront color={c} size={size} /> }} />
      <Tabs.Screen name="trips" options={{ title: 'My trips', tabBarIcon: ({ color: c, size }) => <CalendarClock color={c} size={size} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color: c, size }) => <CircleUser color={c} size={size} /> }} />
    </Tabs>
  )
}
