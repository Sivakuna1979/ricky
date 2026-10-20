import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from './supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
})

/** Ask once (after they order a film) so we can say "your film is ready". */
export async function registerForPush(): Promise<void> {
  if (!Device.isDevice || Platform.OS === 'web') return
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Film updates', importance: Notifications.AndroidImportance.DEFAULT })
  }
  let { status } = await Notifications.getPermissionsAsync()
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status
  if (status !== 'granted') return
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) return
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return
  await supabase.from('ls_devices').upsert({ user_id: session.session.user.id, expo_push_token: token, updated_at: new Date().toISOString() })
}
