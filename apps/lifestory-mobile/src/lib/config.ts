/** Set these in .env (see .env.example). EXPO_PUBLIC_ values are bundled into the app, so never put secrets here. */
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, ''),
  revenueCatIos: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
  revenueCatAndroid: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
}

export const isConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey && config.apiUrl)
