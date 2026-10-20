import { Platform } from 'react-native'
import Purchases, { type PurchasesPackage } from 'react-native-purchases'
import { config } from './config'

/**
 * One film = one in-app purchase (Apple and Google require in-app purchase for digital content).
 * RevenueCat handles both stores. Set up a "default" offering with the film product(s) in the
 * RevenueCat dashboard; see README for the exact steps.
 */
let configured = false

export function setupPurchases(userId: string) {
  const apiKey = Platform.OS === 'ios' ? config.revenueCatIos : Platform.OS === 'android' ? config.revenueCatAndroid : ''
  if (!apiKey) return
  if (!configured) {
    Purchases.configure({ apiKey, appUserID: userId })
    configured = true
  } else {
    void Purchases.logIn(userId)
  }
}

export const paymentsEnabled = () => configured

export interface FilmProduct {
  pkg: PurchasesPackage
  title: string
  price: string
}

export async function filmProducts(): Promise<FilmProduct[]> {
  if (!configured) return []
  const offerings = await Purchases.getOfferings()
  return (offerings.current?.availablePackages ?? []).map((pkg) => ({ pkg, title: pkg.product.title, price: pkg.product.priceString }))
}

/** Returns true if paid, false if the person cancelled. Throws on real errors. */
export async function buy(product: FilmProduct): Promise<boolean> {
  try {
    await Purchases.purchasePackage(product.pkg)
    return true
  } catch (err) {
    if ((err as { userCancelled?: boolean }).userCancelled) return false
    throw err
  }
}
