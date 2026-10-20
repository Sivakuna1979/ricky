import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState, Platform } from 'react-native'
import { config } from './config'

export const supabase = createClient(config.supabaseUrl || 'http://localhost', config.supabaseAnonKey || 'missing', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Keep the session fresh only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh()
    else supabase.auth.stopAutoRefresh()
  })
}

/**
 * People can start making a film without creating an account: we sign them in anonymously and
 * keep the session on the device. (Add "Sign in with Apple/Google" later to move films between phones.)
 */
export async function ensureSession(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user.id
  const { data: signedIn, error } = await supabase.auth.signInAnonymously()
  if (error || !signedIn.user) throw new Error(error?.message ?? 'Could not start a session')
  return signedIn.user.id
}

export const BUCKET = 'lifestory'
