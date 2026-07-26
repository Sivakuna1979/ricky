import { MetadataRoute } from 'next'

const SITE_URL = 'https://food-taxi.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/dashboard', '/api', '/admin', '/account'] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
