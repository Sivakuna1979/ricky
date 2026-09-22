import { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://food-taxi.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // J64 — /order, /receipt and /feedback are per-order pages carrying
      // personal detail (name/phone/items/total), trusted only on an
      // unguessable id — never meant to be crawled/indexed.
      { userAgent: '*', allow: '/', disallow: ['/dashboard', '/api', '/admin', '/account', '/order', '/receipt', '/feedback'] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
