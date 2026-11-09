import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts, Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, Geist_800ExtraBold } from '@expo-google-fonts/geist'
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono'
import { color } from '@/theme'

// Version web autonome (lien de démo) : les polices peuvent être déjà embarquées dans la page.
const FONTS_INLINED = !!(globalThis as { __SM_FONTS_INLINED__?: boolean }).__SM_FONTS_INLINED__

export default function RootLayout() {
  const [loaded] = useFonts(FONTS_INLINED ? {} : { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, Geist_800ExtraBold, GeistMono_500Medium })
  if (!loaded) return null
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color('bg') } }}>
        <Stack.Screen name="(tabs)" />
        {/* Adresse, date et heure : panneaux qui montent du bas. */}
        <Stack.Screen name="place" options={{ presentation: 'modal' }} />
        <Stack.Screen name="when" options={{ presentation: 'modal' }} />
        {/* Pendant la course, pas de retour par geste : on passe par les boutons. */}
        <Stack.Screen name="drive/trip/[id]" options={{ gestureEnabled: false }} />
      </Stack>
    </SafeAreaProvider>
  )
}
