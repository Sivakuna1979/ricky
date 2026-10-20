import { CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond'
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter'
import { useFonts } from 'expo-font'
import * as Notifications from 'expo-notifications'
import { router, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Body, Heading } from '../components/ui'
import { isConfigured } from '../lib/config'
import { setupPurchases } from '../lib/purchases'
import { ensureSession } from '../lib/supabase'
import { colors, fonts } from '../theme'

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ CormorantGaramond_600SemiBold, CormorantGaramond_500Medium_Italic, Inter_400Regular, Inter_500Medium, Inter_600SemiBold })
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isConfigured) return setError('This build is missing its server settings (see .env.example).')
    ensureSession()
      .then((userId) => {
        setupPurchases(userId)
        setReady(true)
      })
      .catch(() => setError('Could not connect. Check your internet connection and reopen the app.'))
  }, [])

  // Tapping "your film is ready" opens that film.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const filmId = response.notification.request.content.data?.filmId
      if (typeof filmId === 'string') router.push(`/film/${filmId}`)
    })
    return () => sub.remove()
  }, [])

  if (!fontsLoaded || (!ready && !error)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    )
  }
  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 32, gap: 12 }}>
        <Heading>Life Story</Heading>
        <Body muted>{error}</Body>
      </View>
    )
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.gold,
          headerTitleStyle: { fontFamily: fonts.medium, color: colors.text },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="new" options={{ title: 'New film', presentation: 'modal' }} />
        <Stack.Screen name="film/[id]/photos" options={{ title: 'Photos' }} />
        <Stack.Screen name="film/[id]/interview" options={{ title: 'Their story' }} />
        <Stack.Screen name="film/[id]/script" options={{ title: 'Your film' }} />
        <Stack.Screen name="film/[id]/index" options={{ title: '' }} />
      </Stack>
    </>
  )
}
