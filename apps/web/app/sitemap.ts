import { MetadataRoute } from 'next'

const SITE_URL = 'https://food-taxi.vercel.app'

// Static marketing/legal pages only — van profiles and search results are
// dynamic and not worth enumerating here.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['', '/search', '/events', '/about', '/contact', '/privacy', '/terms', '/cookies', '/register/business', '/login']
  return paths.map(path => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }))
}
